// Package encoder encodes audio data as Opus packets.
package encoder

import (
	"errors"
	"strconv"
)

// A Bandwidth is a bandwidth that the Opus codec can use.
type Bandwidth int

const (
	// Auto selects the bandwidth automatically.
	Auto Bandwidth = iota
	// NB uses 8 kHz sample rate.
	NB
	// MB uses 12 kHz sample rate.
	MB
	// WB uses 16 kHz sample rate.
	WB
	// SWB uses 24 kHz sample rate.
	SWB
	// FB uses 48 kHz sample rate.
	FB
)

var bwNames = [...]string{
	Auto: "Auto",
	NB:   "NB",
	MB:   "MB",
	WB:   "WB",
	SWB:  "SWB",
	FB:   "FB",
}

func (b Bandwidth) String() (s string) {
	i := int(b)
	if 0 <= i && i < len(bwNames) {
		s = bwNames[i]
	}
	if s == "" {
		s = "Bandwidth(" + strconv.Itoa(i) + ")"
	}
	return
}

// ParseBandwidth parses the text representation of a bandwidth.
func ParseBandwidth(text string) (Bandwidth, error) {
	for i, x := range bwNames {
		if x == text {
			return Bandwidth(i), nil
		}
	}
	return 0, errors.New("invalid bandwidth")
}

// UnmarshalText decodes a text representation of a bandwidth.
func (b *Bandwidth) UnmarshalText(text []byte) error {
	v, err := ParseBandwidth(string(text))
	if err != nil {
		return err
	}
	*b = v
	return nil
}

// MarshalText encodes a text representation of a banwidth.
func (b *Bandwidth) MarshalText() (text []byte, err error) {
	return []byte(b.String()), nil
}

// A Configuration configures the encoder settings.
type Configuration struct {
	Bandwidth   Bandwidth `json:"bandwidth"`
	Bitrate     int       `json:"bitrate"`
	Independent bool      `json:"independent"`
}

// An AudioPacket contains a packet of audio and the configuration to be used for
// encoding it.
type AudioPacket struct {
	Configuration
	Data []int16
}

// An OpusPacket contains encoded Opus audio data.
type OpusPacket []byte

var packetLengths = []int{120, 240, 480, 960, 1920, 2880}

// Length returns the length of the Opus audio packet in samples, after
// decoding.
func (p OpusPacket) Length() int {
	if len(p) == 0 {
		return 0
	}
	ctl := int(p[0])
	var base int
	switch cfg := ctl >> 3; {
	case cfg < 12:
		base = packetLengths[(cfg&3)+2]
	case cfg < 16:
		base = packetLengths[(cfg&1)+2]
	default:
		base = packetLengths[cfg&3]
	}
	var count int
	switch n := ctl & 3; n {
	case 0:
		count = 1
	case 1, 2:
		count = 2
	case 3:
		if len(p) < 2 {
			return 0
		}
		count = int(p[1]) & 63
	}
	return base * count
}
