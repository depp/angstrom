package encoder

// #cgo pkg-config: opus
// #include <opus.h>
// #include <stdlib.h>
//
// static void opus_set(OpusEncoder *enc, int bitrate, int bandwidth, int independent) {
//     opus_encoder_ctl(enc, OPUS_SET_BITRATE(bitrate));
//     opus_encoder_ctl(enc, OPUS_SET_BANDWIDTH(bandwidth));
//     opus_encoder_ctl(enc, OPUS_SET_PREDICTION_DISABLED(independent));
// }
import "C"

import (
	"fmt"

	"moria.us/angstrom/audio"
)

var bwValues = [...]int{
	Auto: C.OPUS_AUTO,
	NB:   C.OPUS_BANDWIDTH_NARROWBAND,
	MB:   C.OPUS_BANDWIDTH_MEDIUMBAND,
	WB:   C.OPUS_BANDWIDTH_WIDEBAND,
	SWB:  C.OPUS_BANDWIDTH_SUPERWIDEBAND,
	FB:   C.OPUS_BANDWIDTH_FULLBAND,
}

func opusError(fname string, oerr C.int) error {
	return fmt.Errorf("%s: %s", fname, C.GoString(C.opus_strerror(oerr)))
}

// Encode encodes the packets using the Opus codec.
func Encode(packets []AudioPacket) ([]OpusPacket, error) {
	if len(packets) == 0 {
		return nil, nil
	}
	var oerr C.int
	enc := C.opus_encoder_create(audio.SampleRate, 1, C.OPUS_APPLICATION_AUDIO, &oerr)
	if enc == nil {
		return nil, opusError("opus_encoder_create", oerr)
	}
	defer C.opus_encoder_destroy(enc)
	results := make([]OpusPacket, 0, len(packets))
	const bufSize = 1024
	buf := C.malloc(bufSize)
	defer C.free(buf)
	for n, p := range packets {
		bitrate := p.Bitrate
		if bitrate <= 0 {
			bitrate = C.OPUS_BITRATE_MAX
		} else if bitrate > 512000 {
			return nil, fmt.Errorf("packet %d: bitrate out of range: %d", n, p.Bitrate)
		}
		i := int(p.Bandwidth)
		if i < 0 || len(bwValues) <= i {
			return nil, fmt.Errorf("packet %d: invalid bandwidth %s", n, p.Bandwidth)
		}
		bandwidth := bwValues[i]
		independent := 0
		if p.Independent {
			independent = 1
		}
		C.opus_set(enc, C.int(bitrate), C.int(bandwidth), C.int(independent))
		if p.Data == nil {
			return nil, fmt.Errorf("packet %d: nil data", n)
		}
		sz := len(p.Data)
		switch sz {
		case 120, 240, 480, 960, 1920, 2880:
		default:
			return nil, fmt.Errorf("packet %d: invalid length: %d", n, sz)
		}
		oerr = C.opus_encode(
			enc, (*C.short)(&p.Data[0]), C.int(sz), (*C.uchar)(buf), bufSize)
		if oerr < 0 {
			return nil, fmt.Errorf("packet %d: %v", n, opusError("opus_encode", oerr))
		}
		results = append(results, OpusPacket(C.GoBytes(buf, oerr)))
	}
	return results, nil
}
