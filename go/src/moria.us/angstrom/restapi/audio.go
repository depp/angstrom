package restapi

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"log"
	"net/http"
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

func (h *audioHandler) createSpectrogram(data []int16) ([]byte, error) {
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

func getSpectrogram(w http.ResponseWriter, r *http.Request) {
	ad := getAudioData(r)
	h := ad.handler
	img, err := h.createSpectrogram(ad.data)
	if err != nil {
		httputil.ServeErrorf(w, r, http.StatusInternalServerError, err.Error())
		return
	}
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
