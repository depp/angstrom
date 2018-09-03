// Package game serves the build of the game.
package game

import (
	"log"
	"net/http"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi"
	"github.com/gorilla/websocket"

	"moria.us/angstrom/httputil"
)

const (
	pongTimeout  = time.Minute
	writeTimeout = 10 * time.Second
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type builder struct {
	mutex   sync.Mutex
	cond    sync.Cond
	tick    int
	readers int
}

func newBuilder() *builder {
	b := &builder{readers: 1}
	b.cond.L = &b.mutex
	go b.ticker()
	return b
}

func (b *builder) ticker() {
	t := time.NewTicker(pongTimeout / 2)
	defer t.Stop()
	for {
		<-t.C
		log.Println("Tick")
		b.mutex.Lock()
		b.tick++
		readers := b.readers
		b.mutex.Unlock()
		if readers == 0 {
			return
		}
		b.cond.Broadcast()
	}
}

func reader(ws *websocket.Conn) {
	defer ws.Close()
	ws.SetReadLimit(1024)
	ws.SetReadDeadline(time.Now().Add(pongTimeout))
	ws.SetPongHandler(func(string) error {
		log.Println("Pong")
		ws.SetReadDeadline(time.Now().Add(pongTimeout))
		return nil
	})
	for {
		_, _, err := ws.ReadMessage()
		if err != nil {
			log.Println("Error: ReadMessage:", err)
			break
		}
	}
}

func writer(b *builder, ws *websocket.Conn) {
	var tick int
	defer func() {
		b.mutex.Lock()
		b.readers--
		b.mutex.Unlock()
		ws.Close()
	}()
	for {
		b.mutex.Lock()
		for b.tick == tick {
			b.cond.Wait()
		}
		tick = b.tick
		b.mutex.Unlock()

		ws.SetWriteDeadline(time.Now().Add(writeTimeout))
		if err := ws.WriteMessage(websocket.PingMessage, nil); err != nil {
			log.Println("Error: WriteMessage", err)
			return
		}
		log.Println("Ping")
	}
}

func getSocket(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Could not upgrade to web socket connection:", err)
		return
	}
	log.Println("Upgraded")
	b := newBuilder()
	go reader(ws)
	go writer(b, ws)
}

// =================================================================================================

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

// =================================================================================================

// NewHandler returns a handler which serves a debug build of the game.
func NewHandler() http.Handler {
	mux := chi.NewMux()
	mux.NotFound(httputil.NotFound)
	mux.Get("/", getIndex)
	mux.Get("/load.js", getFile)
	mux.Get("/build-socket", getSocket)
	return mux
}
