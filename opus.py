import argparse
import io
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
    def __init__(self, mode, rate, length, stereo, frames, data):
        self.mode = mode
        self.rate = rate
        self.length = length
        self.stereo = stereo
        self.frames = frames
        self.data = data

    @classmethod
    def decode(class_, data):
        if not data:
            raise OpusError("empty packet")
        toc = data[0]
        config = toc >> 3
        stereo = bool((toc >> 2) & 1)
        fr_code = toc & 3
        if config < 12:
            mode = "silk"
            rate = RATE_SILK[config >> 2]
            length = LENGTH_SILK[config & 3]
        elif config < 16:
            mode = "hybrid"
            rate = RATE_HYBRID[(config >> 1) & 1]
            length = LENGTH_HYBRID[config & 1]
        else:
            mode = "celt"
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
        return class_(mode, rate, length, stereo, frames, data)

class OpusFile:
    def __init__(self, *, packets, vendor_string, comment_strings,
                 channel_count, preskip, rate, gain):
        self.packets = packets
        self.vendor_string = vendor_string
        self.comment_strings = comment_strings
        self.channel_count = channel_count
        self.preskip = preskip
        self.rate = rate
        self.gain = gain

    @classmethod
    def decode_stream(class_, stream):
        if len(stream.pages) < 3:
            raise OpusError("stream too short")

        page = stream.pages[0]
        if len(page.packets) != 1:
            raise OpusError("invalid header page")
        packet = page.packets[0]
        if not packet.startswith(b"OpusHead"):
            raise OpusError("missing header packet")
        if len(packet) < 19:
            raise OpusError("invalid header packet")
        version, nchan, preskip, rate, gain, mapping = struct.unpack(
            "<BBHIHB", packet[8:19])
        if version != 1:
            raise OpusError("unknown version {}".format(version))

        page = stream.pages[1]
        if len(page.packets) != 1:
            raise OpusError("invalid comment page")
        packet = page.packets[0]
        if not packet.startswith(b"OpusTags"):
            raise OpusError("missing comment packet")
        i = 8
        n = len(packet)
        if 4 > n - i:
            raise OpusError("invalid comment packet")
        m, = struct.unpack("<I", packet[i:i+4])
        i += 4
        if m > n - i:
            raise OpusError("invalid comment packet")
        vstring = packet[i:i+m]
        i += m
        try:
            vstring = vstring.decode("UTF-8")
        except UnicodeDecodeError:
            raise OpusError("invalid vendor string")
        if 4 > n - i:
            raise OpusError("invalid comment packet")
        m, = struct.unpack("<I", packet[i:i+4])
        i += 4
        cstrings = []
        for _ in range(m):
            if 4 > n - i:
                raise OpusError("invalid comment packet")
            m, = struct.unpack("<i", packet[i:i+4])
            i += 4
            if m > n - i:
                raise OpusError("invalid comment packet")
            cstring = packet[i:i+m]
            i += m
            try:
                cstring = cstring.decode("UTF-8")
            except UnicodeDecodeError:
                raise OpusError("invalid user string")
            cstrings.append(cstring)

        packets = []
        for page in stream.pages[2:]:
            for packet in page.packets:
                packets.append(OpusPacket.decode(packet))

        return class_(
            packets=packets,
            vendor_string=vstring,
            comment_strings=cstrings,
            channel_count=nchan,
            preskip=preskip,
            rate=rate,
            gain=gain,
        )

    @classmethod
    def decode_ogg(class_, data):
        for stream in ogg.parse_ogg(data):
            if stream.pages[0].packets[0].startswith(b"OpusHead"):
                return class_.decode_stream(stream)
        raise OpusError("no opus stream")

    def dump(self):
        print("Header: preskip={0.preskip} rate={0.rate} gain={0.gain}"
              .format(self))
        print("Comment:")
        print("  Vendor: {!r}".format(self.vendor_string))
        for cstring in self.comment_strings:
            print("  Comment: {!r}".format(cstring))
        print("Total Packet size:", sum(len(frame) for packet in self.packets
                                        for frame in packet.frames))
        for packet in self.packets:
            print("  Packet mode={0.mode} rate={0.rate} "
                  "length={0.length} stereo={0.stereo} frames={1}"
                  .format(packet, ", ".join(str(len(f))
                                                for f in packet.frames)))

    def to_ogg(self):
        pages = []
        fp = io.BytesIO()

        fp.write(b"OpusHead")
        fp.write(struct.pack(
             "<BBHIHB", 1,
             self.channel_count, self.preskip, self.rate, self.gain, 0))
        pages.append(ogg.OggPage(0, [fp.getvalue()]))

        fp.seek(0)
        fp.truncate()
        fp.write(b"OpusTags")
        cstring = self.vendor_string.encode("UTF-8")
        fp.write(struct.pack("<I", len(cstring)))
        fp.write(cstring)
        fp.write(struct.pack("<I", len(self.comment_strings)))
        for cstring in self.comment_strings:
            cstring = cstring.encode("UTF-8")
            fp.write(struct.pack("<I", len(cstring)))
            fp.write(cstring)
        pages.append(ogg.OggPage(0, [fp.getvalue()]))

        pos = 0
        packets = self.packets
        i = 0
        n = len(packets)
        page_size = 48000 * 4 # Usually 48000
        while i < n:
            ppk = []
            size = 0
            while size < page_size and i < n:
                print(size, i, n)
                pk = packets[i]
                size += pk.length
                i += 1
                ppk.append(pk.data)
            pos += size
            pages.append(ogg.OggPage(pos, ppk))

        return ogg.OggStream(0, pages)

    def to_bytes(self):
        return self.to_ogg().to_bytes()

def main():
    p = argparse.ArgumentParser(allow_abbrev=False)
    p.add_argument("-input", help="input Opus file", required=True)
    p.add_argument("-output", help="output Opus file", required=True)
    args = p.parse_args()

    with open(args.input, "rb") as fp:
        data = fp.read()
    opus = OpusFile.decode_ogg(data)
    opus.dump()
    opus.vendor_string = ""
    opus.comment_strings = []
    opus.rate = 0
    with open(args.output, "wb") as fp:
        fp.write(opus.to_bytes())

if __name__ == "__main__":
    main()
