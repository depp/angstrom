package main

import (
	"fmt"
	"os"

	"moria.us/angstrom/audio"
)

func run(input, output string) error {
	data, err := audio.ReadFile(input)
	if err != nil {
		return err
	}
	fmt.Println("Size:", len(data))
	return audio.WriteFile(output, data)
}

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "error: usage: angstrom <in> <out>")
		os.Exit(2)
	}
	if err := run(os.Args[1], os.Args[2]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
