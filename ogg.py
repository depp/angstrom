import argparse
import struct

class OggError(ValueError):
    def __init__(self, msg):
        self.msg = msg
        self.page_offset = None
        self.offset = None

class OggStream:
    def __init__(self, serno, pages):
        self.serno = serno
        self.pages = pages

class OggPage:
    def __init__(self, pos, packets):
        self.pos = pos
        self.packets = packets

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

    with open(args.input, 'rb') as fp:
        data = fp.read()
    for stream in parse_ogg(data):
        print("Stream serno={0.serno}".format(stream))
        for page in stream.pages:
            print("  Page pos={0.pos}" .format(page))
            for packet in page.packets:
                print("    Packet len={}".format(len(packet)))

if __name__ == "__main__":
    main()
