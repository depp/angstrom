package editor

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi"

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

const (
	iconSuffix = "_24px.svg"
	iconPrefix = "ic_"
)

func scanIcons(root string) map[string]string {
	icons := make(map[string]string)
	path1 := filepath.Join(root, "node_modules/material-design-icons")
	sts1, err := ioutil.ReadDir(path1)
	if err != nil {
		log.Println("Error: could not scan icons:", err)
		return icons
	}
	for _, st1 := range sts1 {
		if !st1.IsDir() {
			continue
		}
		dname := st1.Name()
		path2 := filepath.Join(path1, dname, "svg/production")
		sts2, err := ioutil.ReadDir(path2)
		if err != nil {
			if !os.IsNotExist(err) {
				log.Printf("Error: could not scan %q: %v", path2, err)
			}
			continue
		}
		for _, st2 := range sts2 {
			if !st2.Mode().IsRegular() {
				continue
			}
			name := st2.Name()
			if !strings.HasPrefix(name, iconPrefix) || !strings.HasSuffix(name, iconSuffix) {
				continue
			}
			icons[name[len(iconPrefix):len(name)-len(iconSuffix)]] = dname
		}
	}
	return icons
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

type editorHandlerKey struct{}

type handler struct {
	mux    *chi.Mux
	root   string
	script *provider
	deps   *provider
	icons  map[string]string
}

func getHandler(r *http.Request) *handler {
	return r.Context().Value(editorHandlerKey{}).(*handler)
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
	h.mux.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), editorHandlerKey{}, h)))
}

func getIndex(w http.ResponseWriter, r *http.Request) {
	h := getHandler(r)
	if !h.serveStatic(w, r, "edit.html") {
		httputil.ServeErrorf(w, r, http.StatusInternalServerError, "could not find edit.html")
	}
}

func getScript(w http.ResponseWriter, r *http.Request) {
	h := getHandler(r)
	s, _ := h.script.get().(*script.Script)
	if s == nil {
		httputil.ServeErrorf(w, r, http.StatusInternalServerError,
			"Could not compile script")
		return
	}
	var data []byte
	hdr := w.Header()
	switch name := path.Base(r.URL.Path); name {
	case "edit.js":
		data = s.Script
		hdr.Set("SourceMap", "edit.js.map")
		hdr.Set("Content-Type", "application/javascript")
	case "edit.js.map":
		data = s.SourceMap
		hdr.Set("Content-Type", "text/plain;charset=UTF-8")
	}
	httputil.Log(r, http.StatusOK, "")
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeContent(w, r, "", s.ModTime, bytes.NewReader(data))
}

func getIcon(w http.ResponseWriter, r *http.Request) {
	h := getHandler(r)
	name := chi.URLParam(r, "icon")
	dir, ok := h.icons[name]
	if !ok {
		httputil.NotFound(w, r)
		return
	}
	if !h.serveFile(w, r, path.Join("node_modules/material-design-icons", dir,
		"svg/production", iconPrefix+name+iconSuffix)) {
		httputil.NotFound(w, r)
	}
}

func getFile(w http.ResponseWriter, r *http.Request) {
	h := getHandler(r)
	deps, _ := h.deps.get().(*deps)
	if deps == nil {
		httputil.ServeErrorf(w, r, http.StatusInternalServerError,
			"Could not get dependency map")
		return
	}
	name := chi.URLParam(r, "file")
	fname, ok := deps.files[name]
	if ok {
		if !h.serveFile(w, r, path.Join("node_modules", fname)) {
			httputil.ServeErrorf(w, r, http.StatusInternalServerError, "File is missing")
		}
		return
	}
	if !h.serveStatic(w, r, name) {
		httputil.NotFound(w, r)
	}
}

// NewHandler returns a handler which serves the editor resources.
func NewHandler(root string) http.Handler {
	icons := scanIcons(root)
	mux := chi.NewMux()
	mux.Get("/", getIndex)
	mux.Get("/edit.js", getScript)
	mux.Get("/edit.js.map", getScript)
	mux.Get("/icon/{icon}", getIcon)
	mux.Get("/{file}", getFile)
	depsPath := filepath.Join(root, "editor/node_deps.txt")
	return &handler{
		mux:  mux,
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
		icons: icons,
	}
}
