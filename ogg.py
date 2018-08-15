import argparse
import io
import struct
import zlib

REVERSE_BITS = bytes(int("{:08b}".format(n)[::-1], 2)
                     for n in range(256))

class OggError(ValueError):
    def __init__(self, msg):
        self.msg = msg
        self.page_offset = None
        self.offset = None

class OggStream:
    def __init__(self, serno, pages):
        self.serno = serno
        self.pages = pages

    def to_bytes(self):
        return b"".join([
            page.to_bytes(self.serno, n, n == 0, n == len(self.pages) - 1)
            for n, page in enumerate(self.pages)])

class OggPage:
    def __init__(self, pos, packets):
        self.pos = pos
        self.packets = packets

    def to_bytes(self, serno, seqno, bos, eos):
        fp = io.BytesIO()
        fp.write(b"OggS\0")
        htype = 0
        if bos:
            htype |= 2
        if eos:
            htype |= 1
        segs = []
        for packet in self.packets:
            n = len(packet)
            while n >= 255:
                segs.append(255)
                n -= 255
            segs.append(n)
        fp.write(
            struct.pack("<BQIIIB", htype, self.pos, serno, seqno, 0, len(segs)))
        fp.write(bytes(segs))
        for packet in self.packets:
            fp.write(packet)
        cksum = zlib.crc32(fp.getvalue().translate(REVERSE_BITS), -1)
        cksum, = struct.unpack(
            "<I", struct.pack(">I", ~cksum & 0xffffffff)
            .translate(REVERSE_BITS))
        fp.seek(22)
        fp.write(struct.pack("<I", cksum))
        return fp.getvalue()

def parse_ogg(data):
    i = 0
    n = len(data)
    streams = []
    stream_map = {}
    try:
        while i < n:
            pg_start = i
            if 5 > n - i:
                raise OggError("truncated page")
            if data[i:i+4] != b"OggS":
                raise OggError("missing page header")
            i += 4
            if data[i] != 0:
                raise OggError("unknown stream structure version {}"
                               .format(data[i]))
            i += 1
            if 22 > n - i:
                raise OggError("truncated page")
            htype, pos, serno, seqno, cksum, nsegs = struct.unpack(
                "<BQIIIB", data[i:i+22])
            if htype & 2:
                if serno in stream_map:
                    raise OggError("stream has multiple start pages")
                stream = []
                stream_map[serno] = stream
                streams.append(OggStream(serno, stream))
            else:
                stream = stream_map.get(serno)
                if stream is None:
                    raise OggError("stream has no start page")
            if htype & 4:
                del stream_map[serno]
            if seqno != len(stream):
                raise OggError("got sequence number {}, expected {}"
                               .format(seqno, len(stream)))
            i += 22
            if nsegs > n - i:
                raise OggError("truncated page")
            lacing = data[i:i+nsegs]
            i += nsegs
            packets = []
            pk_start = i
            plen = 0
            for plen in lacing:
                if plen > n - i:
                    raise OggError("truncated page")
                i += plen
                if plen != 255:
                    packets.append(data[pk_start:i])
                    pk_start = i
            if plen == 255:
                raise OggError("incomplete packet")
            got_cksum = zlib.crc32(data[pg_start:pg_start+22]
                                   .translate(REVERSE_BITS), -1)
            got_cksum = zlib.crc32(b"\0\0\0\0", got_cksum)
            got_cksum = zlib.crc32(data[pg_start+26:i]
                                   .translate(REVERSE_BITS), got_cksum)
            got_cksum, = struct.unpack(
                "<I", struct.pack(">I", ~got_cksum & 0xffffffff)
                .translate(REVERSE_BITS))
            print("{:032b} {:032b}".format(cksum, got_cksum))
            stream.append(OggPage(pos, packets))
    except OggError as ex:
        ex.page_offset = pg_start
        ex.offset = i
        raise
    if stream_map:
        raise OggError("unterminated streams")
    return streams

def main():
    p = argparse.ArgumentParser(allow_abbrev=False)
    p.add_argument("input", help="input Ogg file")
    args = p.parse_args()

    with open(args.input, "rb") as fp:
        data = fp.read()
    for stream in parse_ogg(data):
        print("Stream serno={0.serno}".format(stream))
        for page in stream.pages:
            print("  Page pos={0.pos}" .format(page))
            for packet in page.packets:
                print("    Packet len={}".format(len(packet)))

if __name__ == "__main__":
    main()
