import os
import subprocess
import tempfile

import numpy

from abc import ABCMeta, abstractmethod
from typing import IO, List, Optional, Set

def load_audio(path: str) -> numpy.ndarray:
    with open(path, "rb") as fp:
        out = subprocess.run(
            [
                "sox",
                "-",
                "--channels", "1",
                "--bits", "32",
                "--encoding", "floating-point",
                "--endian", "little",
                "--type", "raw",
                "-",
                "rate", "48000",
            ],
            stdin=fp,
            stdout=subprocess.PIPE,
            check=True,
        )
    return numpy.frombuffer(out.stdout, dtype=numpy.float32)

LENGTHS: List[int] = [120, 240, 480, 960, 1920, 2880]

PACKET_INDEX = 0

class Packet(metaclass=ABCMeta):
    def __init__(self, size: int) -> None:
        global PACKET_INDEX
        if size not in LENGTHS:
            raise ValueError("invalid packet length")
        self.index = PACKET_INDEX
        PACKET_INDEX += 1
        self.size = size

    @abstractmethod
    def write(self, dfp: IO[bytes], sfp: IO[str]) -> None: pass

class ZeroPacket(Packet):
    def write(self, dfp: IO[bytes], sfp: IO[str]) -> None:
        print("zero", self.size, file=sfp)

class AudioPacket(Packet):
    def __init__(self, data: numpy.ndarray, *,
                 bitrate: int = 6000,
                 bandwidth: str = "NB",
                 independent: bool = False) -> None:
        super().__init__(len(data))
        self.data = data
        self.bitrate = bitrate
        self.bandwidth = bandwidth
        self.independent = independent

    def write(self, dfp: IO[bytes], sfp: IO[str]) -> None:
        dfp.write(self.data.tobytes())
        print("audio", self.data.shape[0], file=sfp)
        print("bitrate", self.bitrate, file=sfp)
        print("bandwidth", self.bandwidth, file=sfp)
        if self.independent:
            print("independent", file=sfp)
        print("end", file=sfp)
        return self.data.shape[0]

class Stream:
    """A stream of Opus packets to emit.

    Attributes:
      length: Length of the emitted packets, in samples.
      program: List of packets to emit.
    """
    length: int
    packets: List[Packet]

    def __init__(self) -> None:
        self.length = 0
        self.packets = []

    def append(self, packet: Packet) -> None:
        self.length += packet.size
        self.packets.append(packet)

    def extend(self, packets: List[Packet]) -> None:
        self.length += sum(packet.size for packet in packets)
        self.packets.extend(packets)

    def encode(self, path: str) -> None:
        pset: Set[int] = set()
        plist: List[Packet] = []
        for packet in self.packets:
            idx = packet.index
            if idx in pset:
                continue
            pset.add(idx)
            plist.append(packet)
        plist.sort(key=lambda packet: packet.index)
        pmap = {packet.index: n for n, packet in enumerate(plist)}

        exe = os.path.join(
            os.path.dirname(
                os.path.dirname(
                    os.path.dirname(
                        os.path.abspath(__file__)))),
            "opustool/opustool")

        with tempfile.TemporaryDirectory("opuscraft") as d:
            dpath = os.path.join(d, "data")
            spath = os.path.join(d, "script")
            with open(spath, "w") as sfp:
                with open(dpath, "wb") as dfp:
                    for packet in plist:
                        packet.write(dfp, sfp)
                for packet in self.packets:
                    print("emit", pmap[packet.index], file=sfp)

            subprocess.run([exe, dpath, spath, path], check=True)
