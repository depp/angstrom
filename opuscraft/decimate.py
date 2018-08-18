import argparse
import subprocess

import numpy

from . import encode
from . import load

def main():
    p = argparse.ArgumentParser(allow_abbrev=False)
    p.add_argument("input", help="input audio file")
    p.add_argument("output", help="output audio file")
    p.add_argument("-bandwidth", default="NB",
                   choices=("NB", "MB", "WB", "SWB", "FB"),
                   help="output audio bandwidth")
    p.add_argument("-decimate", default=2, type=int,
                   help="packet decimation ratio")
    p.add_argument("-packet-length", default="20",
                   choices=("2.5", "5", "10", "20", "40", "60"),
                   help="packet length, in milliseconds")
    p.add_argument("-independent", action="store_true",
                   help="make packets independent from each other")
    p.add_argument("-bitrate", type=int, default=6000,
                   help="encoding bitrate")
    args = p.parse_args()

    audio = load.load_audio(args.input)
    packet_length = round(48 * float(args.packet_length))
    audio = numpy.concatenate(
        [audio, numpy.zeros((-audio.shape[0] % packet_length,), numpy.float32)])

    stream = encode.Stream()
    packets = numpy.split(audio, audio.shape[0] / packet_length)
    nsamp = 0
    for packet in packets[(args.decimate-1)//2::args.decimate]:
        n = stream.encode_packet(encode.Packet(
            packet,
            bitrate=args.bitrate,
            bandwidth=args.bandwidth,
            independent=args.independent,
        ))
        for i in range(args.decimate):
            stream.emit_packet(n)
            nsamp += packet.shape[0]
    stream.encode(args.output)

    with open(args.output, "rb") as fp:
        out = subprocess.run(["gzip", "-9"], stdin=fp, stdout=subprocess.PIPE)
    nbyte = len(out.stdout)
    alen = nsamp / 48000
    print("Compressed size:", nbyte)
    print("Compressed rate: {:0.3} kbit/s".format(nbyte * 8e-3 / alen))

if __name__ == "__main__":
    main()
