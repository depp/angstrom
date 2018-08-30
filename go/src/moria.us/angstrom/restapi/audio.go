package restapi

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"

	"github.com/go-chi/chi"

	"moria.us/angstrom/audio"
	"moria.us/angstrom/httputil"
)

type audioDataKey struct{}

type audioData struct {
	handler *audioHandler
	data    []int16
}

func getAudioData(r *http.Request) *audioData {
	return r.Context().Value(audioDataKey{}).(*audioData)
}

// =================================================================================================

type audioHandler struct {
	mux *chi.Mux

	python string
	pylib  string
}

func (h *audioHandler) serve(w http.ResponseWriter, r *http.Request, data []int16) {
	h.mux.ServeHTTP(w, r.WithContext(context.WithValue(
		r.Context(), audioDataKey{}, &audioData{handler: h, data: data})))
}

func newAudioHandler(root string) *audioHandler {
	mux := chi.NewMux()
	mux.Get("/audio", getAudio)
	mux.Get("/data", getData)
	mux.Get("/spectrogram", getSpectrogram)
	h := &audioHandler{
		mux: mux,
	}
	if python3, err := exec.LookPath("python3"); err == nil {
		h.python = python3
		h.pylib = filepath.Join(root, "py")
	}
	return h
}

// =================================================================================================

func getAudio(w http.ResponseWriter, r *http.Request) {
	ad := getAudioData(r)
	httputil.Log(r, http.StatusOK, "")
	w.Header().Set("Content-Type", "audio/wav")
	w.WriteHeader(http.StatusOK)
	if r.Method == "HEAD" {
		return
	}
	audio.Write(w, ad.data)
}

func getData(w http.ResponseWriter, r *http.Request) {
	ad := getAudioData(r)
	httputil.Log(r, http.StatusOK, "")
	w.Header().Set("Content-Type", "application/octet-stream")
	w.WriteHeader(http.StatusOK)
	binary.Write(w, binary.LittleEndian, ad.data)
}

type spectrogramConfig struct {
	step int
	bins int
}

func (h *audioHandler) createSpectrogram(data []int16, cfg *spectrogramConfig) ([]byte, error) {
	if h.python == "" {
		return nil, errors.New("Python 3 is not available")
	}
	var abuf bytes.Buffer
	if err := audio.Write(&abuf, data); err != nil {
		return nil, fmt.Errorf("could not create WAVE file: %v", err)
	}
	var stderr, stdout bytes.Buffer
	cmd := &exec.Cmd{
		Path: h.python,
		Args: []string{
			h.python, "-m", "spectrogram",
			"-step", strconv.Itoa(cfg.step),
			"-bins", strconv.Itoa(cfg.bins),
		},
		Dir:    h.pylib,
		Stdin:  bytes.NewReader(abuf.Bytes()),
		Stdout: &stdout,
		Stderr: &stderr,
	}
	if err := cmd.Run(); err != nil {
		os.Stderr.Write(stderr.Bytes())
		log.Println("Error: spectrogram:", err)
		return nil, err
	}
	return stdout.Bytes(), nil
}

func spectrogramParams(q url.Values, size int) (*spectrogramConfig, error) {
	step := 240
	if v := q.Get("step"); v != "" {
		n, err := strconv.Atoi(v)
		step = n
		if err != nil || step <= 0 {
			return nil, errors.New("invalid step")
		}
		if step > audio.SampleRate {
			return nil, errors.New("step is too large")
		}
		if step*2048 < size {
			return nil, errors.New("step is too small")
		}
	}
	bins := 1024
	if v := q.Get("bins"); v != "" {
		n, err := strconv.Atoi(v)
		bins = n
		if err != nil || bins <= 0 {
			return nil, errors.New("invalid bins")
		}
		if bins&(bins-1) != 0 {
			return nil, errors.New("bins is not a power of two")
		}
		if bins > 1024 {
			return nil, errors.New("bins is too large")
		}
	}
	return &spectrogramConfig{
		step: step,
		bins: bins,
	}, nil
}

func getSpectrogram(w http.ResponseWriter, r *http.Request) {
	ad := getAudioData(r)
	cfg, err := spectrogramParams(r.URL.Query(), len(ad.data))
	if err != nil {
		httputil.ServeErrorf(w, r, http.StatusBadRequest, err.Error())
		return
	}
	h := ad.handler
	img, err := h.createSpectrogram(ad.data, cfg)
	if err != nil {
		httputil.ServeErrorf(w, r, http.StatusInternalServerError, err.Error())
		return
	}
	httputil.Log(r, http.StatusOK, "")
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Length", strconv.Itoa(len(img)))
	w.WriteHeader(http.StatusOK)
	if r.Method == "HEAD" {
		return
	}
	for len(img) != 0 {
		n, err := w.Write(img)
		if err != nil {
			return
		}
		img = img[n:]
	}
}
