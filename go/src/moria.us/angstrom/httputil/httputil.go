// Package httputil contains utility code for creating HTTP servers.
package httputil

import (
	"bytes"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"strconv"
)

// Log logs an HTTP response.
func Log(r *http.Request, status int, msg string) {
	if 400 <= status && status <= 599 && status != 404 {
		log.Println(r.Method, r.URL, status, msg)
	} else {
		log.Println(r.Method, r.URL, status)
	}
}

var errTemplate = template.Must(template.New("error").Parse(`<!doctype html>
<html>
  <head>
    <title>{{.Status}}: {{.Title}}</title>
  </head>
  <body>
    <h1>{{.Status}}: {{.Title}}</h1>
    {{if .Message}}
      <p>{{.Message}}</p>
    {{end}}
  </body>
</html>
`))

type errData struct {
	Status  int
	Title   string
	Message string
}

// ServeErrorf serves an HTTP error page.
func ServeErrorf(w http.ResponseWriter, r *http.Request, status int,
	format string, a ...interface{}) {
	data := errData{
		Status:  status,
		Title:   http.StatusText(status),
		Message: fmt.Sprintf(format, a...),
	}
	Log(r, status, data.Message)
	var buf bytes.Buffer
	ctype := "text/html;charset=UTF-8"
	if err := errTemplate.Execute(&buf, data); err != nil {
		log.Println("could not execute error template:", err)
		buf.Reset()
		ctype = "text/plain;charset=UTF-8"
		buf.WriteString(data.Title)
		buf.WriteByte('\n')
		buf.WriteString(data.Message)
	}
	hdr := w.Header()
	hdr.Set("Content-Type", ctype)
	hdr.Set("Content-Length", strconv.Itoa(buf.Len()))
	w.WriteHeader(status)
	if r.Method != "HEAD" {
		w.Write(buf.Bytes())
	}
}

// NotFound serves a 404 Not Found error.
func NotFound(w http.ResponseWriter, r *http.Request) {
	ServeErrorf(w, r, http.StatusNotFound, "Object %q not found", r.URL)
}
