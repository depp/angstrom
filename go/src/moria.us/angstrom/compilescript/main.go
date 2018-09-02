package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"moria.us/angstrom/script"
	"moria.us/angstrom/util"
)

func showResult(s *script.Script) error {
	if s.Success {
		fmt.Println("Build succeeded")
		fmt.Println("===== Script =====")
		nl := 0
		for _, line := range strings.Split(s.Code, "\n") {
			for ; nl > 0; nl-- {
				fmt.Println()
			}
			if line == "" {
				nl++
			} else {
				fmt.Println("  " + line)
			}
		}
		fmt.Println("===== Source Map =====")
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("  ", "  ")
		fmt.Print("  ")
		if err := enc.Encode(s.Map); err != nil {
			return err
		}
	} else {
		fmt.Println("Build failed")
	}
	fmt.Println("===== Diagnostics =====")
	for name, msgs := range s.Diagnostics {
		if len(msgs) == 0 {
			continue
		}
		fmt.Printf("  %s:\n", name)
		for _, msg := range msgs {
			var sev string
			if msg.Severity >= 2 {
				sev = "error"
			} else {
				sev = "warning"
			}
			fmt.Printf("    %d:%d  %s  %s\n", msg.Line, msg.Column, sev, msg.Message)
		}
	}
	return nil
}

func run(root string, watch bool) error {
	const compile = "game/cyber/compile.js"
	fmt.Printf("ROOT: %q\n", root)
	if err := os.Chdir(root); err != nil {
		return err
	}
	if !watch {
		s, err := script.Build(compile, nil)
		if err != nil {
			return fmt.Errorf("could not build script: %v", err)
		}
		return showResult(s)
	}
	ch := make(chan *script.Script)
	go func() {
		defer close(ch)
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		if err := script.WatchBuild(ctx, ch, compile, nil); err != nil {
			fmt.Fprintln(os.Stderr, "Error: WatchBuild:", err)
		}
	}()
	for s := range ch {
		showResult(s)
	}
	return nil
}

func main() {
	var watch bool
	flag.BoolVar(&watch, "watch", false, "watch for changes and run continuously")
	flag.Parse()
	if flag.NArg() > 1 {
		fmt.Fprintln(os.Stderr, "error: usage: compilescript [<root-dir>]")
		os.Exit(2)
	}
	var root string
	if flag.NArg() == 1 {
		root = flag.Arg(0)
	} else {
		r, err := util.FindRoot()
		if err != nil {
			fmt.Fprintln(os.Stderr, "error:", err)
			os.Exit(1)
		}
		root = r
	}
	if err := run(root, watch); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
