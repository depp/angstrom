package main

import (
	"fmt"
	"log"
	"mime"
	"net/http"
	"os"
	"path"

	"github.com/go-chi/chi"

	"moria.us/angstrom/game"
	"moria.us/angstrom/httputil"
	"moria.us/angstrom/util"
)

const addr = "localhost:9000"

func getIndex(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-cache")
	httputil.ServeFile(w, r, "server/index.html")
}

func getNode(w http.ResponseWriter, r *http.Request) {
	p := chi.URLParam(r, "*")
	if path.Join("/", p)[1:] != p {
		log.Println("NOPE", p)
		httputil.NotFound(w, r)
		return
	}
	httputil.ServeFile(w, r, "node_modules/"+p)
}

func run() error {
	root, err := util.FindRoot()
	if err != nil {
		return err
	}
	if err := os.Chdir(root); err != nil {
		return err
	}

	if err := mime.AddExtensionType(".glsl", "text/plain"); err != nil {
		return fmt.Errorf("could not add MIME type: %v", err)
	}

	r := chi.NewMux()
	r.Get("/", getIndex)
	r.Mount("/debug", game.NewHandler(root))
	r.Get("/node_modules/*", getNode)
	fmt.Printf("Listening on http://%s/\n", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		return fmt.Errorf("could not listen: %v", err)
	}
	return nil
}

func main() {
	if len(os.Args) != 1 {
		fmt.Fprintln(os.Stderr, "error: usage: angstrom")
		os.Exit(2)
	}
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
