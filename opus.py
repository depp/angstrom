import argparse
import struct

import ogg

class OpusError(ValueError):
    pass

LENGTH_SILK = [ms * 48 for ms in [10, 20, 40, 60]]
RATE_SILK = [8000, 12000, 16000]
LENGTH_HYBRID = [ms * 48 for ms in [10, 20]]
RATE_HYBRID = [24, 48]
LENGTH_CELT = [round(ms*48) for ms in [2.5, 5, 10, 20]]
RATE_CELT = [8, 16, 24, 48]

class OpusPacket:
    def __init__(self, mode, rate, length, stereo, frames):
        self.mode = mode
        self.rate = rate
        self.length = length
        self.stereo = stereo
        self.frames = frames

    @classmethod
    def decode(class_, data):
        if not data:
            raise OpusError("empty packet")
        toc = data[0]
        config = toc >> 3
        stereo = bool((toc >> 2) & 1)
        fr_code = toc & 3
        if config < 12:
            mode = 'silk'
            rate = RATE_SILK[config >> 2]
            length = LENGTH_SILK[config & 3]
        elif config < 16:
            mode = 'hybrid'
            rate = RATE_HYBRID[(config >> 1) & 1]
            length = LENGTH_HYBRID[config & 1]
        else:
            mode = 'celt'
            rate = RATE_CELT[(config >> 2) & 3]
            length = LENGTH_CELT[config & 3]
        if fr_code == 0:
            frames = [data[1:]]
        elif fr_code == 1:
            n = len(data) - 1
            if len(data) & 1:
                raise OpusError("code 1 packet has odd number of payload bytes")
            n = n // 2
            frames = [data[1:1+n], data[1+n:]]
        elif fr_code == 2:
            if len(data) < 2:
                raise OpusError("truncated packet")
            m = data[1]
            if m < 252:
                fpos = 1
                flen = m
            else:
                if len(data) < 3:
                    raise OpusError("truncated packet")
                fpos = 2
                flen = data[2] * 4 + m
            n = len(data) - fpos
            if flen > m:
                raise OpusError("truncated packet")
            frames = [data[fpos:fpos+flen], data[fpos+flen:]]
        else:
            raise NotImplementedError("code 3 packets not supported")
        return class_(mode, rate, length, stereo, frames)

def main():
    p = argparse.ArgumentParser(allow_abbrev=False)
    p.add_argument("input", help="input Opus files", nargs="+")
    args = p.parse_args()

    for fname in args.input:
        with open(fname, 'rb') as fp:
            data = fp.read()
        for stream in ogg.parse_ogg(data):
            for page in stream.pages[2:]:
                for packet in page.packets:
                    packet = OpusPacket.decode(packet)
                    print("Packet mode={0.mode} rate={0.rate} "
                          "length={0.length} stereo={0.stereo} frames={1}"
                          .format(packet, ", ".join(str(len(f))
                                                    for f in packet.frames)))

if __name__ == "__main__":
    main()
