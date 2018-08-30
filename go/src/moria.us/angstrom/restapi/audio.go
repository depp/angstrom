package restapi

import (
	"context"
	"encoding/binary"
	"net/http"

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
}

func (h *audioHandler) serve(w http.ResponseWriter, r *http.Request, data []int16) {
	h.mux.ServeHTTP(w, r.WithContext(context.WithValue(
		r.Context(), audioDataKey{}, &audioData{handler: h, data: data})))
}

func newAudioHandler() *audioHandler {
	mux := chi.NewMux()
	mux.Get("/audio", getAudio)
	mux.Get("/data", getData)
	mux.Get("/spectrogram", getSpectrogram)
	return &audioHandler{
		mux: mux,
	}
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

func getSpectrogram(w http.ResponseWriter, r *http.Request) {}
