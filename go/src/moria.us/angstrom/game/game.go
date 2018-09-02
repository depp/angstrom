package game

import (
	"net/http"
	"path"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi"

	"moria.us/angstrom/httputil"
)

func getIndex(w http.ResponseWriter, r *http.Request) {
	if !strings.HasSuffix(r.URL.Path, "/") {
		httputil.NotFound(w, r)
		return
	}
	httputil.ServeFile(w, r, "server/debug.html")
}

func getFile(w http.ResponseWriter, r *http.Request) {
	httputil.ServeFile(w, r, filepath.Join("server", path.Base(r.URL.Path)))
}

// NewHandler returns a handler which serves a debug build of the game.
func NewHandler() http.Handler {
	mux := chi.NewMux()
	mux.Get("/", getIndex)
	mux.Get("/load.js", getFile)
	return mux
}
