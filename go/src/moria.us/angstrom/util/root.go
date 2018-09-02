// Package util contains utility functions for build tools.
package util

import (
	"errors"
	"os"
	"path/filepath"
)

// FindRoot returns the root package directory.
func FindRoot() (string, error) {
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
