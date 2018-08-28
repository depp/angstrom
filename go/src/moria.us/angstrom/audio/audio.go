// Package audio reads, writes, and manipulates audio data.
package audio

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"

	"golang.org/x/image/riff"
)

const (
	// SampleRate is the sample rate for all audio, in Hz.
	SampleRate = 48000
)

var (
	riffID = riff.FourCC{'R', 'I', 'F', 'F'}
	waveID = riff.FourCC{'W', 'A', 'V', 'E'}
	fmtID  = riff.FourCC{'f', 'm', 't', ' '}
	dataID = riff.FourCC{'d', 'a', 't', 'a'}
)

// Read reads an audio file.
func Read(r io.Reader) ([]int16, error) {
	le := binary.LittleEndian
	ftype, data, err := riff.NewReader(r)
	if err != nil {
		return nil, err
	}
	if ftype != waveID {
		return nil, errors.New("not a WAVE file")
	}
	state := 0
	var samples []int16
	for {
		cid, clen, cdata, err := data.Next()
		if err != nil {
			if err == io.EOF {
				if state == 2 {
					return samples, nil
				}
				return nil, errors.New("incomplete WAVE file")
			}
			return nil, err
		}
		switch cid {
		case fmtID:
			if state != 0 {
				return nil, errors.New("multiple format chunks")
			}
			if clen < 16 {
				return nil, errors.New("invalid format chunk")
			}
			var d [16]byte
			if _, err := cdata.Read(d[:]); err != nil {
				return nil, err
			}
			if afmt := le.Uint16(d[0:2]); afmt != 1 {
				return nil, fmt.Errorf("WAVE has format %d, only 1 (PCM) is supported", afmt)
			}
			if nch := le.Uint16(d[2:4]); nch != 1 {
				return nil, fmt.Errorf("WAVE has %d channels, only mono is supported", nch)
			}
			if rate := le.Uint32(d[4:8]); rate != SampleRate {
				return nil, fmt.Errorf("WAVE has sample rate %d, only %d is supported",
					rate, SampleRate)
			}
			if bits := le.Uint16(d[14:16]); bits != 16 {
				return nil, fmt.Errorf("WAVE has bit depth %d, only 16 is supported", bits)
			}
			state = 1
		case dataID:
			if state < 1 {
				return nil, errors.New("data chunk appears before format chunk")
			}
			if state > 1 {
				return nil, errors.New("multiple data chunks")
			}
			samples = make([]int16, clen/2)
			if err := binary.Read(cdata, le, samples); err != nil {
				return nil, err
			}
			state = 2
		}
	}
}

// ReadFile reads an audio file by name.
func ReadFile(name string) ([]int16, error) {
	fp, err := os.Open(name)
	if err != nil {
		return nil, err
	}
	defer fp.Close()
	return Read(fp)
}

// Write writes the audio to a WAV file.
func Write(w io.Writer, data []int16) error {
	le := binary.LittleEndian
	var b [44]byte
	copy(b[0:4], riffID[:])
	le.PutUint32(b[4:8], 44+uint32(len(data))*2)
	copy(b[8:12], waveID[:])
	copy(b[12:16], fmtID[:])
	le.PutUint32(b[16:20], 16)
	le.PutUint16(b[20:22], 1)            // Audio format
	le.PutUint16(b[22:24], 1)            // Number of channels
	le.PutUint32(b[24:28], SampleRate)   // Sample rate
	le.PutUint32(b[28:32], SampleRate*2) // Byte rate
	le.PutUint16(b[32:34], 2)            // Block align
	le.PutUint16(b[34:36], 16)           // Bits per sample
	copy(b[36:40], dataID[:])
	le.PutUint32(b[40:44], uint32(len(data))*2)
	if _, err := w.Write(b[:]); err != nil {
		return err
	}
	return binary.Write(w, le, data)
}

// WriteFile writes an audio file by name.
func WriteFile(name string, data []int16) error {
	fp, err := os.Create(name)
	if err != nil {
		return err
	}
	defer fp.Close() // Double-close ok.
	if err := Write(fp, data); err != nil {
		return err
	}
	return fp.Close()
}
