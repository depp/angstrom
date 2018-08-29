package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"moria.us/angstrom/script"
)

func run(root string) error {
	fmt.Printf("ROOT: %q\n", root)
	s, err := script.Compile(root)
	if err != nil {
		if e, ok := err.(*script.CompileError); ok {
			os.Stdout.Write(e.Stderr)
		}
		return err
	}
	fmt.Println("==== Errors ====")
	os.Stdout.Write(s.Errors)
	fmt.Println()

	fmt.Println("==== Script ====")
	os.Stdout.Write(s.Script)
	fmt.Println()

	fmt.Println("==== Source Map ====")
	os.Stdout.Write(s.SourceMap)
	fmt.Println()

	fmt.Println("==== Inputs ====")
	for _, f := range s.Inputs {
		fmt.Println(f)
	}

	return nil
}

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

func main() {
	if len(os.Args) > 2 {
		fmt.Fprintln(os.Stderr, "error: usage: compilescript [<root-dir>]")
		os.Exit(2)
	}
	var root string
	if len(os.Args) == 2 {
		root = os.Args[1]
	} else {
		r, err := findRoot()
		if err != nil {
			fmt.Fprintln(os.Stderr, "error:", err)
			os.Exit(1)
		}
		root = r
	}
	if err := run(root); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
