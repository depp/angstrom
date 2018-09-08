// Package script compiles JavaScript code.
package script

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"os/exec"
)

// A Diagnostic is a diagnostic message emitted during the build process.
type Diagnostic struct {
	Message   string `json:"message"`
	Severity  int    `json:"severity"`
	Line      int    `json:"line,omitempty"`
	Column    int    `json:"column,omitempty"`
	EndLine   int    `json:"endLine,omitempty"`
	EndColumn int    `json:"endColumn,omitempty"`
	RuleID    string `json:"ruleId,omitempty"`
}

// A FileDiagnostics is the set of diagnostic messages for a single source file.
type FileDiagnostics struct {
	File     string        `json:"file,omitempty"`
	Messages []*Diagnostic `json:"messages"`
	Code     string        `json:"code,omitempty"`
}

// A SourceMap is a bidirectional source map. See
// https://sourcemaps.info/spec.html
type SourceMap struct {
	Version        int      `json:"version"`
	File           string   `json:"file,omitempty"`
	SourceRoot     string   `json:"sourceRoot,omitempty"`
	Sources        []string `json:"sources"`
	SourcesContent []string `json:"sourcesContent,omitempty"`
	Names          []string `json:"names,omitempty"`
	Mappings       string   `json:"mappings"`
}

// A Script is the result of building a script, which consists of code, a source
// map, and diagnostic messages. The code and source map will be missing if the
// build failed.
type Script struct {
	Success      bool               `json:"success"`
	ErrorCount   int                `json:"errorCount"`
	WarningCount int                `json:"warningCount"`
	Diagnostics  []*FileDiagnostics `json:"diagnostics"`
	Code         string             `json:"code,omitempty"`
	Map          *SourceMap         `json:"map,omitempty"`
}

// Build builds the script and returns the build result.
func Build(compile string, args []string) (*Script, error) {
	var buf bytes.Buffer
	cmdArgs := []string{compile}
	cmdArgs = append(cmdArgs, args...)
	cmd := exec.Command("node", cmdArgs...)
	cmd.Stdout = &buf
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return nil, err
	}
	scr := new(Script)
	if err := json.Unmarshal(buf.Bytes(), scr); err != nil {
		return nil, err
	}
	return scr, nil
}

// WatchBuild builds the script and writes the build result to the channel. The
// script is then rebuilt as the sources change.
func WatchBuild(ctx context.Context, out chan<- *Script, compile string, args []string) error {
	var cmd *exec.Cmd
	rp, wp, err := os.Pipe()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithCancel(ctx)
	defer func() {
		cancel()
		if rp != nil {
			rp.Close()
		}
		if wp != nil {
			wp.Close()
		}
		cmd.Wait()
	}()
	cmdArgs := []string{compile, "--watch"}
	cmdArgs = append(cmdArgs, args...)
	cmd = exec.CommandContext(ctx, "node", cmdArgs...)
	cmd.Stdout = wp
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return err
	}
	wp.Close()
	wp = nil
	buf := make([]byte, 8*1024)
	var pos int
	for {
		var lineLen int
		for {
			if pos == len(buf) {
				nbuf := make([]byte, len(buf)*2)
				copy(nbuf, buf)
				buf = nbuf
			}
			req := buf[pos:]
			n, err := rp.Read(req)
			if err != nil {
				return err
			}
			opos := pos
			pos += n
			i := bytes.IndexByte(req[:n], '\n')
			if i != -1 {
				lineLen = opos + i
				break
			}
		}
		line := buf[:lineLen]
		scr := new(Script)
		if err := json.Unmarshal(line, scr); err != nil {
			return err
		}
		out <- scr
		copy(buf, buf[lineLen+1:pos])
		pos -= lineLen + 1
	}
}
