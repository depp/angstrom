package main

import (
	"fmt"
	"os"

	"moria.us/angstrom/project"
)

func run(rootDir string) error {
	p, err := project.Open(rootDir)
	if err != nil {
		return fmt.Errorf("could not open project: %v", err)
	}
	if err := p.ScanAudio(); err != nil {
		return fmt.Errorf("could not scan audio: %v", err)
	}
	if err := p.Save(); err != nil {
		return fmt.Errorf("could not save: %v", err)
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
