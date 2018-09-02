package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"moria.us/angstrom/script"
	"moria.us/angstrom/util"
)

func run(root string) error {
	fmt.Printf("ROOT: %q\n", root)
	if err := os.Chdir(root); err != nil {
		return err
	}
	s, err := script.Build("game/cyber/compile.js")
	if err != nil {
		return fmt.Errorf("could not build script: %v", err)
	}

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

func main() {
	if len(os.Args) > 2 {
		fmt.Fprintln(os.Stderr, "error: usage: compilescript [<root-dir>]")
		os.Exit(2)
	}
	var root string
	if len(os.Args) == 2 {
		root = os.Args[1]
	} else {
		r, err := util.FindRoot()
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
