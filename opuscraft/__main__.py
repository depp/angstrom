import json
import os
import sys

import numpy
import scipy.fftpack
import scipy.signal

from . import audio
from . import encode

def get_period(data, pos):
    tmax = 600
    windowed = (data[pos-tmax*2:pos+tmax*2] *
                scipy.signal.windows.blackman(tmax * 4))
    neighborhood = data[pos-tmax*3:pos+tmax*3]
    corr = scipy.signal.convolve(windowed, neighborhood[::-1])
    lcorr = corr[:tmax*5]
    rcorr = corr[tmax*5-1:]
    corr = rcorr + lcorr[::-1]
    i0 = 360
    i1 = 600
    return int(numpy.argmax(corr[i0:i1])) + i0

def extract_looped(data, pos, length, overlap):
    i0 = pos - overlap//2
    i1 = i0 + length + overlap
    clip = numpy.roll(data[i0:i1], overlap)
    clip[:overlap*2] *= numpy.cos(
        numpy.linspace(0, 2*numpy.pi, overlap * 2)) * 0.5 + 0.5
    tail = clip[:overlap]
    body = clip[overlap:]
    body[:overlap] += tail
    return numpy.roll(body, -overlap//2)

def extract_pitched(data, pos, length):
    # Find actual period.
    period = get_period(data, pos)
    n0 = length // period
    n1 = n0 + 1
    if n0 == 0 or n0 * n1 * period**2 < length**2:
        n = n1
    else:
        n = n0
    #print("Choosing between",
    #      48000 / period, 48000 * n0 / length, 48000 * n1 / length)
    print("Resizing clip: {} -> {} ({} Hz -> {} Hz)"
          .format(n * period, length, 48000 / period, 48000 * n / length))
    clip = extract_looped(data, pos, n * period, period)
    if len(clip) == length:
        return clip
    y = scipy.fftpack.rfft(clip)
    if len(y) < length:
        y = numpy.concatenate([y, numpy.zeros(length - len(y))])
    elif len(y) > length:
        y = y[:length]
    return scipy.fftpack.irfft(y).astype(numpy.float32)

class Stream:
    def __init__(self):
        self.packets = []
        self.length = 0
        self.marks = []
        self.names = []

class Encoder:
    def __init__(self):
        self.clipdata = None
        self.stream = None
        self.packets = []
        self.sounds = {}
        self.words = {}
        self.files = {}
        self.dirpath = None

    def run_script(self, path):
        fullpath = os.path.abspath(path)
        self.dirpath = os.path.dirname(fullpath)
        with open(sys.argv[1]) as fp:
            for lineno, line in enumerate(fp, 1):
                self.run_line(line)

    def run_line(self, line):
        line = line.strip()
        if not line or line.startswith("#"):
            return
        fields = line.split(maxsplit=1)
        if len(fields) == 2:
            cmd, rest = fields
        else:
            cmd = fields[0]
            rest = ""
        if cmd == "<":
            self.encode(*rest.split())
        elif cmd == ">":
            self.emit(*rest.split())
        elif cmd == "input":
            fpath = os.path.join(self.dirpath, rest)
            self.clipdata = audio.Audio.load(fpath).data
        elif cmd == "output":
            self.stream = Stream()
            self.files[rest] = self.stream
        elif cmd == "word":
            self.stream = Stream()
            self.words[rest] = self.stream
        elif cmd == "end":
            self.stream = None
        elif cmd == "mark":
            self.stream.marks.append(self.stream.length)
            self.stream.names.append(rest)
        else:
            print("Error: Unknown command:", repr(cmd), file=sys.stderr)
            raise SystemExit(1)

    def encode(self, name, start, length, *args):
        start = int(start)
        length = int(length)
        assert (length % 10) == 0 and length > 0
        pitched = False
        for arg in args:
            i = arg.find(":")
            if i != -1:
                value = arg[i+1:]
                arg = arg[:i]
            else:
                value = ""
            if arg == "pitched":
                pitched = True
            else:
                raise ValueError("bad arg {!r}".format(arg))
        clip = self.clipdata
        assert clip is not None
        if pitched:
            clip = extract_pitched(clip, (start - length//2) * 48, length * 48)
        else:
            clip = clip[start*48:(start+length)*48]
        assert(len(clip) == length * 48)
        packets = []
        independent = True
        for n in [60,40,20,10]:
            m = n * 48
            while len(clip) >= m:
                packet = encode.Packet(clip[:m], independent=independent)
                clip = clip[m:]
                packets.append((len(self.packets), n))
                self.packets.append(packet)
                independent = False
        self.sounds[name] = packets

    def emit(self, name, length="-"):
        word = self.words.get(name)
        if word is not None:
            assert length == "-"
            self.stream.packets.extend(word.packets)
            self.stream.length += word.length
            return
        packets = self.sounds[name]
        if length == "-":
            self.stream.packets.extend(idx for idx, n in packets)
            self.stream.length += sum(n for idx, n in packets)
            return
        i = 0
        length = int(length)
        rem = length
        while True:
            idx, n = packets[i % len(packets)]
            if rem * 2 < n:
                break
            self.stream.packets.append(idx)
            self.stream.length += n
            rem -= n
            i += 1

    def save(self):
        s = encode.Stream()
        s.packets = self.packets
        for name, stream in self.files.items():
            fpath = os.path.join(self.dirpath, name)
            os.makedirs(os.path.dirname(fpath), exist_ok=True)
            s.stream = stream.packets
            s.encode(fpath)
            obj = {
                "marks": stream.marks + [stream.length],
                "names": stream.names,
            }
            with open(fpath + ".json", "w") as fp:
                json.dump(obj, fp, indent=True, sort_keys=True)

def main():
    import sys

    if len(sys.argv) != 2:
        print("Error: Need script", file=sys.stderr)
        raise SystemExit(2)

    e = Encoder()
    e.run_script(sys.argv[1])
    e.save()

if __name__ == "__main__":
    main()
