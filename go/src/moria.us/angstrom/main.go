package main

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi"

	"moria.us/angstrom/editor"
	"moria.us/angstrom/project"
	"moria.us/angstrom/restapi"
)

const addr = "localhost:9000"

func findRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		pkg := filepath.Join(dir, "package.json")
		if _, err := os.Stat(pkg); err == nil {
			return dir, nil
		}
		old := dir
		dir = filepath.Dir(dir)
		if old == dir {
			return "", errors.New("cannot find angstrom root directory")
		}
	}
}

func run(projDir string) error {
	srcDir, err := findRoot()
	if err != nil {
		return err
	}
	p, err := project.Open(projDir)
	if err != nil {
		return fmt.Errorf("could not open project: %v", err)
	}
	if err := p.ScanAudio(); err != nil {
		return fmt.Errorf("could not scan audio: %v", err)
	}

	r := chi.NewMux()
	r.Mount("/api", restapi.NewHandler(p))
	r.Mount("/editor", editor.NewHandler(srcDir))
	fmt.Printf("Listening on http://%s/\n", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		return fmt.Errorf("could not listen: %v", err)
	}
	return nil
}

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "error: usage: angstrom <project-dir>")
		os.Exit(2)
	}
	if err := run(os.Args[1]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
