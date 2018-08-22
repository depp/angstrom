import argparse
import math

import numpy
import scipy.fftpack
import scipy.signal
import subprocess

from . import audio

def extract_loop_fade(data, pos, period):
    if len(data) < period * 2:
        print("Error: audio too short")
        raise SystemExit(1)
    pos = max(period, min(len(data) - period, pos))
    data = data[pos-period:pos+period]
    data *= (
        numpy.cos(numpy.linspace(-numpy.pi, numpy.pi, period * 2)) * 0.5 + 0.5)
    data = numpy.roll(data, period//2)
    data = data[:period] + data[period:]
    return data

def extract_pitched(data, pos, period):
    if len(data) < period * 6:
        print("Error: audio too short")
        raise SystemExit(1)

    # Adjust peak so "pos" is there.
    if True:
        pos = max(period * 3, min(len(data) - period * 3, pos))
        wsize = period * 3 >> 2
        neighborhood = data[pos-wsize:pos+wsize]
        neighborhood = scipy.signal.convolve(
            numpy.square(neighborhood),
            scipy.signal.blackman(period + 1))
        neighborhood = neighborhood[period//2:period//2+wsize*2]
        peak = int(numpy.argmax(neighborhood))
        pos += peak - wsize

    # Find actual period.
    pos = max(period * 3, min(len(data) - period * 3, pos))
    windowed = (data[pos-period*2:pos+period*2] *
                scipy.signal.windows.blackman(period * 4))
    neighborhood = data[pos-period*3:pos+period*3]
    corr = scipy.signal.convolve(windowed, neighborhood[::-1])
    lcorr = corr[:period*5]
    rcorr = corr[period*5-1:]
    corr = rcorr + lcorr[::-1]
    i0 = 360
    i1 = 600
    nperiod = int(numpy.argmax(corr[i0:i1])) + i0

    # Fold down to one period.
    oneper = data[pos-nperiod:pos+nperiod]
    oneper *= (
        numpy.cos(numpy.linspace(-numpy.pi, numpy.pi, nperiod * 2)) * 0.5 + 0.5)
    oneper = numpy.roll(oneper, nperiod//2)
    oneper = oneper[:nperiod] + oneper[nperiod:]

    # FFT to correct size.
    y = scipy.fftpack.rfft(oneper)
    if len(y) < period:
        y = numpy.concatenate([y, numpy.zeros(period - len(y))])
    elif len(y) > period:
        y = y[:period]
    return scipy.fftpack.irfft(y).astype(numpy.float32)

def main():
    p = argparse.ArgumentParser(allow_abbrev=False)
    p.add_argument("-pos", default=0.5, type=float,
                   help="relative position to extract audio from")
    p.add_argument("-pitched", action="store_true",
                   help="extract a pitched segment of audio")
    p.add_argument("-unpitched", action="store_false",
                   dest="pitched",
                   help="extract an unpiched segment of audio")
    p.add_argument("-high-pass", type=float, default=50,
                   help="pass audio through a high-pass filter")
    p.add_argument("-level", type=float, default=-16,
                   help="peak output level")
    p.add_argument("-loop", action="store_true",
                   help="loop the output to make it longer")
    p.add_argument("-length", type=int, default=1,
                   help="length, in 10ms units")
    p.add_argument("input", help="input WAVE file path")
    p.add_argument("output", help="output WAVE file path")
    args = p.parse_args()

    clip = audio.Audio.load(args.input)
    data = clip.data

    # High pass filter.
    b, a = scipy.signal.butter(4, args.high_pass / 24000, "highpass")
    data = scipy.signal.lfilter(b, a, data).astype(numpy.float32)

    # Extract a single period.
    pos = round(len(data) * args.pos)
    if args.pitched:
        data = extract_pitched(data, pos, 480 * args.length)
    else:
        data = extract_loop_fade(data, pos, 480 * args.length)

    # Normalize the level.
    rms = math.sqrt(numpy.mean(numpy.square(data)))
    print("RMS:", 20 * math.log10(rms))
    data = data * (10**(args.level * 0.05) / rms)
    clipped = numpy.count_nonzero(data < -1) + numpy.count_nonzero(data > 1)

    # Loop.
    if args.loop:
        data = numpy.tile(data, 100)

    audio.Audio(data).save(args.output)

if __name__ == "__main__":
    main()
