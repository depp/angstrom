// Package restapi defines the REST API for the editor.
package restapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"

	"github.com/go-chi/chi"

	"moria.us/angstrom/httputil"
	"moria.us/angstrom/project"
)

type webContextKey struct{}

type handler struct {
	mux *chi.Mux

	proj  *project.Project
	mutex sync.Mutex
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), webContextKey{}, h)))
}

func getHandler(r *http.Request) *handler {
	return r.Context().Value(webContextKey{}).(*handler)
}

// =================================================================================================

func handleError(w http.ResponseWriter, r *http.Request, err error) {
	if err == project.ErrNotFound {
		httputil.NotFound(w, r)
	} else {
		httputil.ServeErrorf(w, r, http.StatusInternalServerError, err.Error())
	}
}

func writeJSON(w http.ResponseWriter, r *http.Request, status int, d interface{}) {
	log.Println(r.Method, r.URL, status)

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	enc.Encode(d)
	data := buf.Bytes()

	hdr := w.Header()
	hdr.Set("Content-Type", "application/json")
	hdr.Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(status)
	if r.Method == "HEAD" {
		return
	}
	for len(data) != 0 {
		n, err := w.Write(data)
		if err != nil {
			return
		}
		data = data[n:]
	}
}

func readJSON(w http.ResponseWriter, r *http.Request, d interface{}) bool {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(d); err != nil {
		httputil.ServeErrorf(w, r, http.StatusBadRequest, "Could not parse JSON: %v", err)
		return false
	}
	return true
}

// =================================================================================================

func getClipData(r *http.Request) (*project.Clip, error) {
	clipName := chi.URLParam(r, "clip")
	h := getHandler(r)
	h.mutex.Lock()
	defer h.mutex.Unlock()
	return h.proj.GetClip(clipName)
}

func getClips(w http.ResponseWriter, r *http.Request) {
	clips, err := func() ([]*project.ClipInfo, error) {
		h := getHandler(r)
		h.mutex.Lock()
		defer h.mutex.Unlock()
		return h.proj.GetClips()
	}()
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, clips)
}

func getClip(w http.ResponseWriter, r *http.Request) {
	clip, err := getClipData(r)
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, clip)
}

func updateClip(w http.ResponseWriter, r *http.Request) {}

// =================================================================================================

func sliceParam(r *http.Request) (string, int, bool) {
	clipName := chi.URLParam(r, "clip")
	sliceName := chi.URLParam(r, "slice")
	sliceIdx, err := strconv.Atoi(sliceName)
	if err != nil || sliceIdx < 0 || sliceName != strconv.Itoa(sliceIdx) {
		return "", 0, false
	}
	return clipName, sliceIdx, true
}

func getSlices(w http.ResponseWriter, r *http.Request) {
	clip, err := getClipData(r)
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, clip.Slices)
}

func insertSlice(w http.ResponseWriter, r *http.Request) {
	clipName := chi.URLParam(r, "clip")
	slice := new(project.Slice)
	if !readJSON(w, r, slice) {
		return
	}
	err := func() error {
		h := getHandler(r)
		h.mutex.Lock()
		defer h.mutex.Unlock()
		return h.proj.InsertSlice(clipName, slice)
	}()
	if err != nil {
		handleError(w, r, err)
		return
	}
	w.Header().Set("Location", fmt.Sprintf("/api/clip/%s/slice/%d", slice.Clip, slice.Index))
	writeJSON(w, r, http.StatusCreated, slice)
}

func getSlice(w http.ResponseWriter, r *http.Request) {}

func deleteSlice(w http.ResponseWriter, r *http.Request) {}

func updateSlice(w http.ResponseWriter, r *http.Request) {}

// =================================================================================================

func segmentParam(r *http.Request) (string, int, bool) {
	clipName := chi.URLParam(r, "clip")
	segmentName := chi.URLParam(r, "segment")
	segmentIdx, err := strconv.Atoi(segmentName)
	if err != nil || segmentIdx < 0 || segmentName != strconv.Itoa(segmentIdx) {
		return "", 0, false
	}
	return clipName, segmentIdx, true
}

func getSegments(w http.ResponseWriter, r *http.Request) {
	clip, err := getClipData(r)
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, clip.Segments)
}

func insertSegment(w http.ResponseWriter, r *http.Request) {}

func getSegment(w http.ResponseWriter, r *http.Request) {}

func deleteSegment(w http.ResponseWriter, r *http.Request) {}

func updateSegment(w http.ResponseWriter, r *http.Request) {}

// =================================================================================================

func NewHandler(p *project.Project) http.Handler {
	r := chi.NewMux()
	r.Route("/clip", func(r chi.Router) {
		r.Get("/", getClips)
		r.Route("/{clip}", func(r chi.Router) {
			r.Get("/", getClip)
			r.Put("/", updateClip)
			r.Route("/slice", func(r chi.Router) {
				r.Get("/", getSlices)
				r.Post("/", insertSlice)
				r.Route("/{slice}", func(r chi.Router) {
					r.Get("/", getSlice)
					r.Delete("/", deleteSlice)
					r.Put("/", updateSlice)
				})
			})
			r.Route("/segment", func(r chi.Router) {
				r.Get("/", getSegments)
				r.Post("/", insertSegment)
				r.Route("/{segment}", func(r chi.Router) {
					r.Get("/", getSegment)
					r.Delete("/", deleteSegment)
					r.Put("/", updateSegment)
				})
			})
		})
	})
	return &handler{
		mux:  r,
		proj: p,
	}
}
