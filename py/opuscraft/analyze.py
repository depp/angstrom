import math
import sys

import numpy
import scipy.fftpack
import scipy.signal

def get_period(data: numpy.ndarray, pos: int) -> int:
    """Return the period of pitched audio.

    This does simple autocorrelation and will only return periods in the range
    360-600.

    Arguments:
      data: The audio data, in float32 format.
      pos: The sample position in the audio to analyze pitch.
    """
    tmax = 600
    if not (tmax*3 < pos < len(data) - tmax*3):
        raise ValueError("Position out of range")
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

def extract_clip(data: numpy.ndarray, pos: int, length: int) -> numpy.ndarray:
    """Extract a section of an audio array."""
    end = pos + length
    if not (0 <= pos <= end <= len(data)):
        raise ValueError("Position out of range")
    return data[pos:end]

def extract_looped(data: numpy.ndarray,
                   pos: int, length: int, overlap: int) -> numpy.ndarray:
    """Extract a section of audio made into a loop.

    The loop is made by extracting some extra audio around the selected range
    and blending it.
    """
    i0 = pos - overlap//2
    i1 = i0 + length + overlap
    if not (0 <= i0 <= i1 <= len(data)):
        raise ValueError("Position out of range")
    clip = numpy.roll(data[i0:i1], overlap)
    clip[:overlap*2] *= numpy.cos(
        numpy.linspace(0, 2*numpy.pi, overlap * 2)) * 0.5 + 0.5
    tail = clip[:overlap]
    body = clip[overlap:]
    body[:overlap] += tail
    return numpy.roll(body, -overlap//2)

def extract_pitched(name: str, data: numpy.ndarray,
                    pos: int, length: int) -> numpy.ndarray:
    mpos = pos + length//2
    period = get_period(data, mpos)
    n0 = length // period
    n1 = n0 + 1
    if n0 == 0 or n0 * n1 * period**2 < length**2:
        n = n1
    else:
        n = n0
    print("Changing pitch of {:3s} {:3.0f} Hz -> {:3.0f} Hz"
          .format(name, 48000 / period, 48000 * n / length),
          file=sys.stderr)
    loop = extract_looped(data, mpos - period*n//2, period*n, period)
    y = scipy.fftpack.rfft(loop)
    if len(loop) != length:
        if len(y) < length:
            y = numpy.concatenate([y, numpy.zeros(length - len(y))])
        elif len(y) > length:
            y = y[:length]
        loop = scipy.fftpack.irfft(y).astype(numpy.float32)
    #print(name, ', '.join(
    #    '{:.1f}'.format(y[i*2]**2 + y[i*2+1]**2) for i in range(n+1)))
    dphase = 0.5 * math.pi - math.atan2(y[2*n], y[2*n+1])
    dsamp = round(dphase * length / (2 * math.pi * n))
    return numpy.roll(loop, dsamp)
