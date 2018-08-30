// Package script compiles the editor script.
package script

import (
	"bufio"
	"bytes"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"
)

// A CompileError is an error that occurs during script compilation.
type CompileError struct {
	Message string
	Stderr  []byte
}

func (e *CompileError) Error() string {
	return e.Message
}

const (
	nodeModules  = "node_modules"
	scriptDir    = "editor/src"
	tsc          = "node_modules/.bin/tsc"
	tsconfig     = "editor/src/tsconfig.json"
	rollup       = "node_modules/.bin/rollup"
	rollupconfig = "editor/src/rollup.config.js"
)

// An Input is an input source file needed to compile the script.
type Input struct {
	Name    string
	ModTime time.Time
}

// A Script is the compiled editor script.
type Script struct {
	Root      string
	ModTime   time.Time
	Script    []byte
	SourceMap []byte
	Inputs    []Input
	Errors    []byte
}

type workspace struct {
	srcDir   string
	buildDir string
	dirs     map[string]bool
}

func (w *workspace) mkdir(dir string) error {
	if w.dirs[dir] {
		return nil
	}
	if par := filepath.Dir(dir); par != dir {
		if err := w.mkdir(par); err != nil {
			return err
		}
	}
	if err := os.Mkdir(filepath.Join(w.buildDir, dir), 0777); err != nil {
		return err
	}
	w.dirs[dir] = true
	return nil
}

func (w *workspace) symlink(name string) error {
	if err := w.mkdir(path.Dir(name)); err != nil {
		return err
	}
	return os.Symlink(
		filepath.Join(w.srcDir, name),
		filepath.Join(w.buildDir, name))
}

// Compile compiles the editor script.
func Compile(root string) (*Script, error) {
	log.Print("Compiling script")

	// Create temporary build directory.
	dir, err := ioutil.TempDir("", "angstrom")
	if err != nil {
		return nil, fmt.Errorf("could not create temporary directory: %v", err)
	}
	defer func() {
		if err := os.RemoveAll(dir); err != nil {
			log.Printf("Error: could not clean up temporary directory %q: %v", dir, err)
		}
	}()
	w := workspace{
		srcDir:   root,
		buildDir: dir,
		dirs:     map[string]bool{".": true},
	}

	// Copy in source files.
	statCache := make(map[string]os.FileInfo)
	if err := w.symlink("node_modules"); err != nil {
		return nil, err
	}
	sts, err := ioutil.ReadDir(filepath.Join(root, scriptDir))
	if err != nil {
		return nil, fmt.Errorf("could not scan script directory: %v", err)
	}
	for _, st := range sts {
		if st.Mode()&os.ModeType != 0 {
			continue
		}
		name := st.Name()
		fname := filepath.Join(scriptDir, name)
		statCache[fname] = st
		if !strings.HasSuffix(name, ".ts") || strings.HasPrefix(name, ".") {
			continue
		}
		if err := w.symlink(fname); err != nil {
			return nil, err
		}
	}
	if err := w.symlink(rollupconfig); err != nil {
		return nil, err
	}
	if err := w.symlink(tsconfig); err != nil {
		return nil, err
	}

	var inputs []Input
	var stderr bytes.Buffer

	// Compile TypeScript.
	st, ok := statCache[tsconfig]
	if !ok {
		return nil, fmt.Errorf("missing %s", tsconfig)
	}
	inputs = append(inputs, Input{tsconfig, st.ModTime()})
	tscPath := filepath.Join(root, tsc)
	var stdout bytes.Buffer
	cmd := &exec.Cmd{
		Path: tscPath,
		Args: []string{
			tscPath,
			"--project", tsconfig,
			"--sourceMap",
			"--listFiles",
			"--pretty",
			"--target", "ES2015",
			"--moduleResolution", "node",
		},
		Dir:    dir,
		Stdout: &stdout,
	}
	err = cmd.Run()
	sep := string(os.PathSeparator)
	prefix := dir
	if !strings.HasSuffix(prefix, sep) {
		prefix += sep
	}
	for sc := bufio.NewScanner(bytes.NewReader(stdout.Bytes())); sc.Scan(); {
		line := sc.Bytes()
		if len(line) == 0 || line[0] != '/' {
			stderr.Write(line)
			stderr.WriteByte('\n')
			continue
		}
		file := string(line)
		if !strings.HasPrefix(file, prefix) {
			continue
		}
		rfile := file[len(prefix):]
		st, ok = statCache[rfile]
		if !ok {
			return nil, fmt.Errorf("unexpected input file %q", rfile)
		}
		inputs = append(inputs, Input{rfile, st.ModTime()})
	}
	if err != nil {
		return nil, &CompileError{
			Message: fmt.Sprintf("compilation failed: %v", err),
			Stderr:  stderr.Bytes(),
		}
	}

	// Bundle JavaScript.
	st, ok = statCache[rollupconfig]
	if !ok {
		return nil, fmt.Errorf("missing %s", rollupconfig)
	}
	inputs = append(inputs, Input{rollupconfig, st.ModTime()})
	rollupPath := filepath.Join(root, rollup)
	cmd = &exec.Cmd{
		Path: rollupPath,
		Args: []string{
			rollupPath,
			"--config", rollupconfig,
		},
		Dir:    dir,
		Stderr: &stderr,
	}
	if err := cmd.Run(); err != nil {
		return nil, &CompileError{
			Message: fmt.Sprintf("rollup failed: %v", err),
			Stderr:  stderr.Bytes(),
		}
	}

	// Collect output.
	js, err := ioutil.ReadFile(filepath.Join(dir, "edit.js"))
	if err != nil {
		return nil, err
	}
	srcmap, err := ioutil.ReadFile(filepath.Join(dir, "edit.js.map"))
	if err != nil {
		return nil, err
	}
	return &Script{
		Root:      root,
		ModTime:   time.Now(),
		Script:    js,
		SourceMap: srcmap,
		Inputs:    inputs,
		Errors:    stderr.Bytes(),
	}, nil
}

// IsOutdated returns true if the inputs have changed and the script should be
// recompiled.
func (s *Script) IsOutdated() bool {
	for _, in := range s.Inputs {
		fname := filepath.Join(s.Root, in.Name)
		st, err := os.Stat(fname)
		if err != nil || st.ModTime().After(in.ModTime) {
			return true
		}
	}
	return false
}
