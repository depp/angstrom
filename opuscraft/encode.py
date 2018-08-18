import os
import subprocess
import tempfile

class Packet:
    def __init__(self, data, *, bitrate=6000, bandwidth="NB",
                 independent=False):
        self.data = data
        self.bitrate = bitrate
        self.bandwidth = bandwidth
        self.independent = independent

class Stream:
    def __init__(self):
        self.packets = []
        self.stream = []

    def encode_packet(self, p):
        n = len(self.packets)
        self.packets.append(p)
        return n

    def emit_packet(self, n):
        self.stream.append(n)

    def encode(self, path):
        exe = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "opustool/opustool")

        with tempfile.TemporaryDirectory("opuscraft") as d:
            dpath = os.path.join(d, "data")
            spath = os.path.join(d, "script")
            with open(spath, "w") as sfp:
                with open(dpath, "wb") as dfp:
                    n = 0
                    for packet in self.packets:
                        dfp.write(packet.data.tobytes())
                        m = packet.data.shape[0]
                        print("audio", n, m, file=sfp)
                        n += m
                        print("bitrate", packet.bitrate, file=sfp)
                        print("bandwidth", packet.bandwidth, file=sfp)
                        if packet.independent:
                            print("independent", file=sfp)
                        print("end", file=sfp)
                for n in self.stream:
                    print("emit", n, file=sfp)

            subprocess.run([exe, dpath, spath, path], check=True)
