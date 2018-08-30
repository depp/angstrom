package editor

import (
	"bufio"
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"moria.us/angstrom/httputil"
	"moria.us/angstrom/script"
)

// =================================================================================================

type deps struct {
	name  string
	mtime time.Time
	files map[string]string
}

func readDeps(name string) (*deps, error) {
	fp, err := os.Open(name)
	if err != nil {
		return nil, err
	}
	defer fp.Close()
	st, err := fp.Stat()
	if err != nil {
		return nil, err
	}
	sc := bufio.NewScanner(fp)
	files := make(map[string]string)
	for lineno := 1; sc.Scan(); lineno++ {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) != 2 {
			return nil, fmt.Errorf("%q:%d: got %d fields, expected 2", name, lineno, len(fields))
		}
		src := path.Join("/", fields[0])
		dest := path.Clean(fields[1])
		if _, ok := files[src]; ok {
			return nil, fmt.Errorf("%q:%d: duplicate file %q", name, lineno, src)
		}
		files[src] = dest
	}
	return &deps{
		name:  name,
		mtime: st.ModTime(),
		files: files,
	}, nil
}

func (d *deps) IsOutdated() bool {
	st, err := os.Stat(d.name)
	if err != nil {
		return true
	}
	return st.ModTime().After(d.mtime)
}

// =================================================================================================

type resource interface {
	IsOutdated() bool
}

type provider struct {
	create func() resource
	lock   sync.Mutex
	value  resource
	wg     *sync.WaitGroup
}

func newProvider(create func() resource) *provider {
	return &provider{create: create}
}

func (pr *provider) get() resource {
	pr.lock.Lock()
	value := pr.value
	wg := pr.wg
	pr.lock.Unlock()

	if wg != nil {
		wg.Wait()
		pr.lock.Lock()
		value = pr.value
		pr.lock.Lock()
		return value
	}
	if value != nil && !value.IsOutdated() {
		return value
	}

	pr.lock.Lock()
	if pr.wg != nil {
		wg = pr.wg
	} else if pr.value == value {
		wg = new(sync.WaitGroup)
		wg.Add(1)
		go func() {
			var value resource
			defer func() {
				pr.lock.Lock()
				pr.value = value
				pr.wg = nil
				pr.lock.Unlock()
				wg.Done()
			}()
			value = pr.create()
		}()
	} else {
		value = pr.value
	}
	pr.lock.Unlock()

	if wg != nil {
		wg.Wait()
		pr.lock.Lock()
		value = pr.value
		pr.lock.Unlock()
	}
	return value
}

// =================================================================================================

type handler struct {
	root   string
	script *provider
	deps   *provider
}

func (h *handler) serveScript(w http.ResponseWriter, r *http.Request, name string) bool {
	s, _ := h.script.get().(*script.Script)
	if s == nil {
		httputil.ServeErrorf(w, r, http.StatusInternalServerError,
			"Could not compile script")
		return true
	}
	var data []byte
	hdr := w.Header()
	if name == "/edit.js" {
		data = s.Script
		hdr.Set("SourceMap", "edit.js.map")
		hdr.Set("Content-Type", "application/javascript")
	} else {
		data = s.SourceMap
		hdr.Set("Content-Type", "text/plain;charset=UTF-8")
	}
	httputil.Log(r, http.StatusOK, "")
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeContent(w, r, "", s.ModTime, bytes.NewReader(data))
	return true
}

func (h *handler) serveFile(w http.ResponseWriter, r *http.Request, name string) bool {
	fpath := filepath.Join(h.root, name)
	fp, err := os.Open(fpath)
	if err != nil {
		if os.IsNotExist(err) {
			return false
		}
		httputil.ServeErrorf(w, r, http.StatusInternalServerError,
			"Could not open %q: %v", fpath, err)
		return true
	}
	st, err := fp.Stat()
	if err != nil {
		httputil.ServeErrorf(w, r, http.StatusInternalServerError,
			"Could not stat %q: %v", fpath, err)
		return true
	}
	defer fp.Close()
	httputil.Log(r, http.StatusOK, "")
	http.ServeContent(w, r, filepath.Base(name), st.ModTime(), fp)
	return true
}

func (h *handler) serveDep(w http.ResponseWriter, r *http.Request, name string) bool {
	deps, _ := h.deps.get().(*deps)
	if deps == nil {
		httputil.ServeErrorf(w, r, http.StatusInternalServerError,
			"Could not get dependency map")
		return true
	}
	fname, ok := deps.files[name]
	if !ok {
		return false
	}
	if !h.serveFile(w, r, path.Join("node_modules", fname)) {
		httputil.ServeErrorf(w, r, http.StatusInternalServerError, "File is missing")
	}
	return true
}

func (h *handler) serveStatic(w http.ResponseWriter, r *http.Request, name string) bool {
	// This sanitizes any ".." in the path.
	cname := path.Clean(name)
	if cname != name {
		return false
	}
	w.Header().Set("Cache-Control", "no-cache")
	return h.serveFile(w, r, path.Join("editor/static", cname))
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET", "HEAD":
	default:
		w.Header().Set("Allow", "GET, HEAD")
		httputil.ServeErrorf(w, r, http.StatusMethodNotAllowed, "")
		return
	}
	switch name := strings.TrimPrefix(r.URL.Path, "/editor"); name {
	case "/":
		if h.serveStatic(w, r, "edit.html") {
			return
		}
	case "/edit.js", "/edit.js.map":
		if h.serveScript(w, r, name) {
			return
		}
	default:
		if h.serveDep(w, r, name) {
			return
		}
		if h.serveStatic(w, r, name) {
			return
		}
	}
	httputil.NotFound(w, r)
}

// NewHandler returns a handler which serves the editor resources.
func NewHandler(root string) http.Handler {
	depsPath := filepath.Join(root, "editor/node_deps.txt")
	return &handler{
		root: root,
		script: newProvider(func() resource {
			s, err := script.Compile(root)
			if err != nil {
				if e, ok := err.(*script.CompileError); ok {
					os.Stderr.Write(e.Stderr)
				}
				log.Println("Error: could not compile script:", err)
				return nil
			}
			return s
		}),
		deps: newProvider(func() resource {
			deps, err := readDeps(depsPath)
			if err != nil {
				log.Println("Error: could not read node dependencies:", err)
				return nil
			}
			return deps
		}),
	}
}
