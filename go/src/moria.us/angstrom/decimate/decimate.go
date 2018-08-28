package main

import (
	"flag"
	"fmt"
	"os"
	"strconv"

	"moria.us/angstrom/audio"
	"moria.us/angstrom/encoder"
)

func run(input, output string) error {
	data, err := audio.ReadFile(input)
	if err != nil {
		return err
	}
	fmt.Println("Size:", len(data))
	return audio.WriteFile(output, data)
}

type args struct {
	ratio     int
	bandwidth encoder.Bandwidth
	bitrate   int
	input     string
	output    string
}

func parseArgs() (*args, error) {
	var ratio int
	var bandwidth string
	var bitrate string
	flag.IntVar(&ratio, "ratio", 2, "decimation ratio")
	flag.StringVar(&bandwidth, "bandwidth", "Auto",
		"Opus encoder bandwidth (Auto, NB, MB, WB, SWB, FB)")
	flag.StringVar(&bitrate, "bitrate", "Auto",
		"Opus encoder bitrate (Auto or 1..512000)")
	flag.Parse()
	a := new(args)
	if flag.NArg() != 2 {
		return nil, fmt.Errorf("got %d arguments, expected 2", flag.NArg())
	}
	a.input = flag.Arg(0)
	a.output = flag.Arg(1)
	if ratio < 1 {
		return nil, fmt.Errorf("invalid -ratio %d", ratio)
	}
	a.ratio = ratio
	bw, err := encoder.ParseBandwidth(bandwidth)
	if err != nil {
		return nil, fmt.Errorf("invalid -bandwidth %q: %v", bandwidth, err)
	}
	a.bandwidth = bw
	if bitrate == "Auto" {
		a.bitrate = 0
	} else {
		i, err := strconv.Atoi(bitrate)
		if err != nil {
			return nil, fmt.Errorf("invalid -bitrate: %q", a.bitrate)
		}
		if i < 1 || 512000 < i {
			return nil, fmt.Errorf("out of range -bitrate: %d, must be in the range 1..512000", i)
		}
		a.bitrate = i
	}
	return a, nil
}

func encode(a *args) error {
	data, err := audio.ReadFile(a.input)
	if err != nil {
		return fmt.Errorf("could not open input: %v", err)
	}
	const packetSize = 480
	cfg := encoder.Configuration{
		Bandwidth:   a.bandwidth,
		Bitrate:     a.bitrate,
		Independent: true,
	}
	var packets []encoder.AudioPacket
	for ctr := 0; len(data) >= packetSize; ctr = (ctr + 1) % a.ratio {
		if ctr == 0 {
			packets = append(packets, encoder.AudioPacket{
				Configuration: cfg,
				Data:          data[:packetSize],
			})
		}
		data = data[packetSize:]
	}
	spackets, err := encoder.Encode(packets)
	if err != nil {
		return fmt.Errorf("could not encode Opus: %v", err)
	}
	dpackets := make([]encoder.OpusPacket, 0, len(spackets)*a.ratio)
	for _, p := range spackets {
		for i := 0; i < a.ratio; i++ {
			dpackets = append(dpackets, p)
		}
	}
	fp, err := os.Create(a.output)
	if err != nil {
		return err
	}
	defer fp.Close() // Double-close okay.
	if err := encoder.Write(fp, dpackets); err != nil {
		return fmt.Errorf("could not write Ogg stream: %v", err)
	}
	return fp.Close()
}

func main() {
	if len(os.Args) == 1 {
		fmt.Fprintln(os.Stderr, "error: usage: decimate [<option>] <in> <out>")
		os.Exit(2)
	}
	a, err := parseArgs()
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(2)
	}
	if err := encode(a); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
