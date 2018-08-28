package encoder

// #cgo pkg-config: ogg
// #include <ogg/ogg.h>
//
// static int ogg_stream_packetin2(ogg_stream_state *os, ogg_packet *op, unsigned char *bytes) {
//     op->packet = bytes;
//     return ogg_stream_packetin(os, op);
// }
import "C"

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"unsafe"

	"moria.us/angstrom/audio"
)

func writePage(w io.Writer, os *C.ogg_stream_state, flush bool) error {
	const fillBytes = 1 << 16
	for {
		var og C.ogg_page
		var r C.int
		if flush {
			r = C.ogg_stream_flush_fill(os, &og, fillBytes)
		} else {
			r = C.ogg_stream_pageout_fill(os, &og, fillBytes)
		}
		if r == 0 {
			if C.ogg_stream_check(os) != 0 {
				return errors.New("could not create Ogg page")
			}
			return nil
		}
		if _, err := w.Write(
			C.GoBytes(unsafe.Pointer(og.header), C.int(og.header_len))); err != nil {
			return err
		}
		if _, err := w.Write(
			C.GoBytes(unsafe.Pointer(og.body), C.int(og.body_len))); err != nil {
			return err
		}
	}
}

func writeHead(w io.Writer, os *C.ogg_stream_state) error {
	var buf [19]byte
	le := binary.LittleEndian
	copy(buf[:8], "OpusHead")                  // Magic
	buf[8] = 1                                 // Version
	buf[9] = 1                                 // Channel count
	le.PutUint16(buf[10:12], 0)                // Preskip
	le.PutUint32(buf[12:16], audio.SampleRate) // Sample rate
	le.PutUint16(buf[16:18], 0)                // Gain
	buf[18] = 0                                // Mapping family
	r := C.ogg_stream_packetin2(os, &C.ogg_packet{
		bytes: C.long(len(buf)),
		b_o_s: 1,
	}, (*C.uchar)(&buf[0]))
	if r != 0 {
		return errors.New("could not write Opus header")
	}
	return writePage(w, os, true)
}

func writeTags(w io.Writer, os *C.ogg_stream_state) error {
	var buf [16]byte
	copy(buf[:8], "OpusTags")
	r := C.ogg_stream_packetin2(os, &C.ogg_packet{
		bytes: C.long(len(buf)),
	}, (*C.uchar)(&buf[0]))
	if r != 0 {
		return errors.New("could not write Opus comment")
	}
	return writePage(w, os, true)
}

func writeData(w io.Writer, os *C.ogg_stream_state, packets []OpusPacket) error {
	pos := 0
	for n, p := range packets {
		pos += p.Length()
		fmt.Println(p.Length())
		var eos C.long
		if n == len(packets)-1 {
			eos = 1
		}
		r := C.ogg_stream_packetin2(os, &C.ogg_packet{
			bytes:      C.long(len(p)),
			e_o_s:      eos,
			granulepos: C.long(pos),
		}, (*C.uchar)(&p[0]))
		if r != 0 {
			return errors.New("could not write Opus data")
		}
		if err := writePage(w, os, false); err != nil {
			return err
		}
	}
	return writePage(w, os, true)
}

// Write writes the Opus packets to an Ogg stream.
func Write(w io.Writer, packets []OpusPacket) error {
	var os C.ogg_stream_state
	r := C.ogg_stream_init(&os, 1)
	if r != 0 {
		return errors.New("could not initialize Ogg stream")
	}
	defer C.ogg_stream_clear(&os)
	if err := writeHead(w, &os); err != nil {
		return err
	}
	if err := writeTags(w, &os); err != nil {
		return err
	}
	return writeData(w, &os, packets)
}
