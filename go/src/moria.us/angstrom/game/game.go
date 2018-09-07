// Package game serves the build of the game.
package game

import (
	"bytes"
	"context"
	"encoding/json"
	"io/ioutil"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/go-chi/chi"
	"github.com/gorilla/websocket"

	"moria.us/angstrom/fileset"
	"moria.us/angstrom/httputil"
	"moria.us/angstrom/script"
)

const (
	pongTimeout       = 5 * time.Second
	writeTimeout      = 10 * time.Second
	buildFailureRetry = 5 * time.Second
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type handlerKey struct{}

type handler struct {
	root string
	mux  *chi.Mux

	mutex   sync.Mutex
	builder *builder
}

func getHandler(r *http.Request) *handler {
	return r.Context().Value(handlerKey{}).(*handler)
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), handlerKey{}, h)))
}

func (h *handler) openBuilder() *builder {
	h.mutex.Lock()
	b := h.builder
	if b == nil {
		b = &builder{
			handler: h,
			files:   fileset.New(),
		}
		b.cond.L = &b.mutex
		h.builder = b
		go b.ticker()
		go b.scriptBuilder()
		go b.watcher()
	}
	h.mutex.Unlock()
	return b
}

func (h *handler) getBuilder() *builder {
	h.mutex.Lock()
	b := h.builder
	h.mutex.Unlock()
	return b
}

// =================================================================================================

type builder struct {
	handler *handler

	mutex    sync.Mutex
	cond     sync.Cond
	version  int // Increment when tick or fversion changes.
	tick     int // Increment when it's time to send a ping.
	files    *fileset.Set
	fversion int // Increment when files changes.
}

func (b *builder) ticker() {
	t := time.NewTicker(pongTimeout / 2)
	defer t.Stop()
	for {
		<-t.C
		b.mutex.Lock()
		b.tick++
		b.version++
		b.mutex.Unlock()
		b.cond.Broadcast()
	}
}

func (b *builder) setFiles(files []fileset.FileVersion) {
	if len(files) == 0 {
		return
	}
	b.mutex.Lock()
	stamp := time.Now()
	changed := b.files.SetFiles(stamp, files)
	b.files.Expire(stamp)
	if changed {
		b.fversion++
		b.version++
	}
	b.mutex.Unlock()
	if changed {
		b.cond.Broadcast()
	}
}

func (b *builder) scriptBuilder() {
	ch := make(chan *script.Script)
	go b.scriptRunner(ch)
	for s := range ch {
		files := make([]fileset.FileVersion, 0, 2)
		data, err := json.Marshal(s.Diagnostics)
		if err != nil {
			panic("Could not marshal diagnostics: " + err.Error())
		}
		files = append(files, fileset.FileVersion{
			Name:    "diagnostics/script",
			Version: &fileset.Version{Data: data},
		})
		if s.Success {
			ver := &fileset.Version{Data: []byte(s.Code)}
			if m := s.Map; m != nil {
				m.File = ""
				m.SourceRoot = b.handler.root
				data, err := json.Marshal(m)
				if err != nil {
					panic("Could not marshal sourcemap: " + err.Error())
				}
				ver.Map = data
			}
			files = append(files, fileset.FileVersion{
				Name:    "game.js",
				Version: ver,
			})
		}
		b.setFiles(files)
	}
}

func (b *builder) scriptRunner(ch chan<- *script.Script) {
	defer close(ch)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	for {
		if err := script.WatchBuild(ctx, ch, "tools/compile.js",
			[]string{"--config=debug"}); err != nil {
			log.Println("Error: Build failed:", err)
			log.Printf("Retrying (delay = %v)", buildFailureRetry)
			<-time.After(buildFailureRetry)
		} else {
			log.Println("Restarting builder")
		}
	}
}

const shaderDir = "game/cyber/shader"

func (b *builder) watcher() {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		log.Println("Error: Could not watch files:", err)
		return
	}
	defer w.Close()
	if err := w.Add(shaderDir); err != nil {
		log.Println("Error: Could not add watch:", err)
		return
	}
	sts, err := ioutil.ReadDir(shaderDir)
	if err != nil {
		log.Println("Error: Could not list directory:", err)
		return
	}
	for _, st := range sts {
		b.watchEvent(fsnotify.Event{
			Name: filepath.Join(shaderDir, st.Name()),
			Op:   fsnotify.Create,
		})
	}
	for e := range w.Events {
		b.watchEvent(e)
	}
}

func (b *builder) watchEvent(e fsnotify.Event) {
	dir := filepath.Dir(e.Name)
	if dir != shaderDir {
		return
	}
	fname := filepath.Base(e.Name)
	if strings.HasPrefix(fname, ".") || strings.HasPrefix(fname, "#") {
		return
	}
	if !strings.HasSuffix(fname, ".glsl") {
		return
	}
	if e.Op&(fsnotify.Create|fsnotify.Write|fsnotify.Remove|fsnotify.Rename) == 0 {
		return
	}
	var ver *fileset.Version
	fp, err := os.Open(e.Name)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("Error: Could not open %q: %v", e.Name, err)
			return
		}
	} else {
		defer fp.Close()
		data, err := ioutil.ReadAll(fp)
		if err != nil {
			log.Printf("Error: Could not read %q: %v", e.Name, err)
			return
		}
		ver = &fileset.Version{
			Data: data,
		}
	}
	b.setFiles([]fileset.FileVersion{{
		Name:    path.Join("shader", fname),
		Version: ver,
	}})
}

func websocketError(err error, fn string) {
	if websocket.IsCloseError(err, websocket.CloseGoingAway) {
		return
	}
	log.Printf("Error: %s: %v", fn, err)
}

func reader(b *builder, ws *websocket.Conn, closed *int32) {
	defer ws.Close()
	ws.SetReadLimit(1024)
	ws.SetReadDeadline(time.Now().Add(pongTimeout))
	ws.SetPongHandler(func(string) error {
		ws.SetReadDeadline(time.Now().Add(pongTimeout))
		return nil
	})
	defer func() {
		atomic.StoreInt32(closed, 1)
		b.cond.Broadcast()
	}()
	for {
		_, _, err := ws.ReadMessage()
		if err != nil {
			websocketError(err, "ReadMessage")
			break
		}
	}
}

func writer(b *builder, ws *websocket.Conn, closed *int32) {
	defer ws.Close()
	var version, tick, fversion int
	manifest := make(fileset.Manifest)
	for {
		b.mutex.Lock()
		for b.version == version && atomic.LoadInt32(closed) == 0 {
			b.cond.Wait()
		}
		version = b.version
		doTick := tick != b.tick
		tick = b.tick
		var delta map[string]*string
		if fversion != b.fversion {
			delta = b.files.GetDelta(manifest)
			fversion = b.fversion
		}
		b.mutex.Unlock()

		if atomic.LoadInt32(closed) != 0 {
			return
		}

		if doTick {
			ws.SetWriteDeadline(time.Now().Add(writeTimeout))
			if err := ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				websocketError(err, "ReadMessage")
				return
			}
		}

		if len(delta) != 0 {
			ws.SetWriteDeadline(time.Now().Add(writeTimeout))
			if err := ws.WriteJSON(delta); err != nil {
				websocketError(err, "WriteJSON")
				return
			}
		}
	}
}

func getSocket(w http.ResponseWriter, r *http.Request) {
	h := getHandler(r)
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Could not upgrade to web socket connection:", err)
		return
	}
	b := h.openBuilder()
	closed := new(int32)
	go reader(b, ws, closed)
	go writer(b, ws, closed)
}

// =================================================================================================

func getIndex(w http.ResponseWriter, r *http.Request) {
	if !strings.HasSuffix(r.URL.Path, "/") {
		httputil.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-cache")
	httputil.ServeFile(w, r, "server/debug.html")
}

func getFile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-cache")
	httputil.ServeFile(w, r, filepath.Join("server", path.Base(r.URL.Path)))
}

func getData(w http.ResponseWriter, r *http.Request) {
	b := getHandler(r).getBuilder()
	if b == nil {
		httputil.NotFound(w, r)
		return
	}
	name := chi.URLParam(r, "*")
	isSourceMap := strings.HasSuffix(name, ".map")
	if isSourceMap {
		name = name[:len(name)-4]
	}
	t := r.URL.Query().Get("t")
	if t == "" {
		b.mutex.Lock()
		ver := b.files.GetLatest(name)
		b.mutex.Unlock()
		var data []byte
		if ver != nil {
			if isSourceMap {
				data = ver.Map
			} else {
				data = ver.Data
			}
		}
		if data == nil {
			httputil.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		httputil.Redirect(w, r, &url.URL{
			Path:     r.URL.Path,
			RawQuery: url.Values{"t": []string{ver.VersionName()}}.Encode(),
		})
		return
	}
	b.mutex.Lock()
	ver := b.files.GetVersion(name, t)
	b.mutex.Unlock()
	var data []byte
	var ctype, smap string
	if ver != nil {
		if isSourceMap {
			data = ver.Map
			ctype = "application/json"
		} else {
			data = ver.Data
			ctype = mime.TypeByExtension(path.Ext(name))
			if ver.Map != nil {
				u := &url.URL{
					Path:     path.Base(name) + ".map",
					RawQuery: url.Values{"t": []string{t}}.Encode(),
				}
				smap = u.String()
			}
		}
	}
	if data == nil {
		httputil.NotFound(w, r)
		return
	}
	hdr := w.Header()
	hdr.Set("Content-Type", ctype)
	if smap != "" {
		hdr.Set("SourceMap", smap)
	}
	hdr.Set("Cache-Control", "max-age=3600")
	httputil.Log(r, http.StatusOK, "")
	http.ServeContent(w, r, "", ver.Timestamp(), bytes.NewReader(data))
}

// =================================================================================================

// NewHandler returns a handler which serves a debug build of the game.
func NewHandler(root string) http.Handler {
	mux := chi.NewMux()
	mux.NotFound(httputil.NotFound)
	mux.Get("/", getIndex)
	mux.Get("/load.js", getFile)
	mux.Get("/style.css", getFile)
	mux.Get("/build-socket", getSocket)
	mux.Get("/data/*", getData)
	return &handler{
		root: root,
		mux:  mux,
	}
}
