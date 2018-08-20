import math
import os
import subprocess

import numpy
import PIL.Image
import scipy.signal

from typing import Tuple, Union

def palette_from_rgb(rgb: numpy.ndarray) -> numpy.ndarray:
    """Create a palette for Pillow from a floating-point RGB array.

    Arguments:
       rgb: Floating-point array with shape (3,N) and values in range [0,1].
            The red, green, and blue channels are rgb[0], rgb[1], and rgb[2].

    Returns: A uint8 array containing repeated R,G,B tuples with values in the
             range [0,255].
    """
    return numpy.clip(rgb * 256, 0, 255).astype(numpy.uint8).flatten("F")

def rgb_from_hsl(hsl: numpy.ndarray) -> numpy.ndarray:
    """Create an RGB color array from an HSL color array.

    Arguments:
      hsl: Floating-point array with shape (3,N). The hue is hsl[0], and is
           measured in degrees (so 270 is the same as -90 or 630). The
           saturation is hsl[1] and the lightness is hsl[2], both must be in
           the range [0,1].

    Returns: A floating-point array with shape (3,N) containing RGB values in
             the range [0,1].
    """
    hp = hsl[0] * (1/60) % 6
    oxc = numpy.zeros((3, hsl.shape[1]), numpy.float32)
    oxc[2] = (1 - numpy.abs(2 * hsl[2] - 1)) * hsl[1]
    oxc[1] = oxc[2] * (1 - numpy.abs(hp % 2 - 1))
    oxc += (hsl[2] - 0.5 * oxc[2])
    hi = numpy.floor(hp).astype(numpy.int32) % 6
    idx = numpy.array([2, 1, 0, 0, 1, 2], numpy.int32)
    rng = numpy.arange(hsl.shape[1], dtype=numpy.int32)
    return numpy.array(
        [oxc[idx[hi], rng],
         oxc[numpy.roll(idx, 2)[hi], rng],
         oxc[numpy.roll(idx, 4)[hi], rng]],
        dtype=numpy.float32)

def color_ramp() -> numpy.ndarray:
    """Create a color ramp for displaying spectrogram data.

    Returns: A uint8 array with size 256*3 for use with Pillow as a palette.
    """
    return palette_from_rgb(rgb_from_hsl(numpy.array(
        [numpy.linspace(-90, +90, 256, numpy.float32),
         numpy.full((256,), 1.0, numpy.float32),
         numpy.linspace(0, 1, 256, numpy.float32)],
        dtype=numpy.float32)))

def dilate(a: numpy.ndarray, n: int) -> numpy.ndarray:
    """Dilate a binary 1D array."""
    c, = a.shape
    z = numpy.zeros((n+1,), numpy.int32)
    s = numpy.cumsum(numpy.concatenate([z, a.astype(numpy.int32), z]))
    return s[1+2*n:1+2*n+c] > s[0:c]

def erode(a: numpy.ndarray, n: int) -> numpy.ndarray:
    """Erode a binary 1D array."""
    return numpy.logical_not(dilate(numpy.logical_not(a), n))

def data_segments(data: numpy.ndarray, step: int, nsamp: int) -> numpy.ndarray:
    """Split an ndarray into potentially overlapping segments."""
    return numpy.lib.stride_tricks.as_strided(
        data,
        shape=(data.shape[:-1] +
               ((data.shape[-1] + step - nsamp) // step, nsamp)),
        strides=(data.strides[:-1] +
                 (step * data.strides[-1], data.strides[-1])),
        writeable=False,
    )

class Audio:
    """An audio segment containing 48 kHz float32 monophonic sound.

    Attributes:
      data: NumPy array containing audio data in float32 format.
    """
    FREQUENCY = 48000

    def __init__(self, data: numpy.ndarray) -> None:
        if not isinstance(data, numpy.ndarray):
            raise TypeError("data is a {}, expected {}"
                            .format(type(data), numpy.ndarray))
        if data.dtype != numpy.float32:
            raise TypeError("element type is {}, expected {}"
                            .format(data.dtype, numpy.float32))
        if len(data.shape) != 1:
            raise TypeError("data has dimension {}, expected 1",
                            len(data.shape))
        self.data = data

    @classmethod
    def load(class_, path: str) -> "Audio":
        """Load an audio file from the given path."""
        with open(path, "rb") as fp:
            out = subprocess.run(
                [
                    "sox",
                    "-",
                    "--channels", "1",
                    "--bits", "32",
                    "--encoding", "floating-point",
                    "--type", "raw",
                    "--endian", "little",
                    "-",
                    "rate", str(class_.FREQUENCY),
                ],
                stdin=fp,
                stdout=subprocess.PIPE,
                check=True,
            )
        data = numpy.frombuffer(out.stdout, dtype=numpy.float32)
        return class_(data)

    def slice(self, start: int, end: int) -> "Audio":
        return Audio(self.data[start:end])

    def spectrogram(self,
                    step:int=240,
                    bins:int=1024,
                    dbrange:Tuple[float, float]=(-120.0, -40.0)) -> PIL.Image:
        """Create a spectrogram of the audio clip.

        Arguments:
          step: Number of audio samples per horizontal pixel.
          bins: Number of FFT bins to use.
          dbrange: The (min,max) range for signal levels.

        Returns: A PIL image of the audio spectrogram.
        """
        f, t, s = scipy.signal.spectrogram(
            self.data,
            self.FREQUENCY,
            nperseg=bins,
            noverlap=(bins - step),
            window="blackman",
            mode='magnitude')
        s = s[::-1]
        min_db, max_db = dbrange
        db_to_image = 256 / (max_db - min_db)
        s = (numpy.log(s) * (db_to_image * 20 / math.log(10)) -
             min_db * db_to_image)
        s = numpy.clip(s, 0, 255).astype(numpy.uint8)
        img = PIL.Image.fromarray(s.astype(numpy.uint8), "L")
        img.putpalette(color_ramp())
        return img

    def level(self,
              window_size:int=1024) -> numpy.ndarray:
        """Analyze the level of the audio clip.

        Arguments:
          window_size: Window size to use for analysis.

        Returns: A NumPy array of signal magnitude, relative to a full scale
        sine wave.
        """
        window = (scipy.signal.windows.blackman(window_size)
                  .astype(numpy.float32))
        wsum = numpy.sum(window)
        mag2 = scipy.signal.convolve(numpy.square(self.data), window)
        mag2 = mag2[(window_size-1)//2:(window_size-1)//2+self.data.shape[0]]
        return numpy.sqrt(mag2 * (2.0 / wsum))

    def pitch(self,
              step:int=240,
              freq_range:Tuple[float, float]=(80.0, 260.0),
              audio_threshold:float=-40.0,
              corr_threshold:float=-10.0) -> numpy.ndarray:
        """Analyze the pitch of the audio clip.

        Arguments:
          step: Number of audio samples per data point.
          freq_range: The (min,max) range for frequencies to detect.
          audio_threshold: Minimum audio strength, in dB, for analyzing pitch.
          corr_threshold: Minimum autocorrelation, in dB, to consider pitch
                          detection successful.

        Returns: A NumPy array of pitches, with NaN inserted wherever pitch
        detection failed (either the audio signal was too low or the
        autocorrelation was too low).
        """
        # Window size: must be at least one period of lowest frequency we care
        # about, but two periods is better.
        fmin, fmax = freq_range
        wsize = round(self.FREQUENCY * 2 / fmin)
        window = scipy.signal.windows.blackman(wsize).astype(numpy.float32)
        wsum = numpy.sum(window)

        # The range of autocorrelation coefficients that we care about.
        i0 = round(self.FREQUENCY / fmax)
        i1 = round(self.FREQUENCY / fmin)

        # Break audio into segments, calculate autocorrelation of each segment
        # with a windowed copy of that segment.
        nsamp = wsize + i1 + 1
        window = numpy.concatenate(
            [window, numpy.zeros((i1 + 1,), numpy.float32)])
        segments = data_segments(self.data, step, nsamp)
        nseg = len(segments)
        corr = numpy.empty((nseg, i1 + 1), numpy.float32)
        for i, seg in enumerate(segments):
            corr[i] = (scipy.signal.convolve(
                seg * window, seg[::-1]))[nsamp-1:nsamp+i1]
        corr *= 1.0 / wsum

        # Find autocorrelation peaks, and therefore pitch.
        peakidx = numpy.argmax(corr[:,i0:i1+1], axis=1) + i0
        peakstr = corr[numpy.arange(corr.shape[0]),peakidx]
        pitch = self.FREQUENCY / peakidx

        # Insert NaN whenever pitch detection failed.
        sigstr = corr[:,0]
        pitch[numpy.where(
            (sigstr < 10**(audio_threshold * 0.1)) |
            (peakstr < sigstr * 10**(corr_threshold * 0.1)))] = numpy.nan

        return pitch

def main() -> None:
    import argparse

    p = argparse.ArgumentParser(allow_abbrev=False)

    sp = p.add_subparsers(help="subcommand help")
    sp.required = True
    sp.dest = "cmd"

    pp = sp.add_parser("spectrogram",
                       help="create a spectrogram of the audio file")
    pp.add_argument("audio", help="input audio file")
    pp.add_argument("output", help="output image file")
    def spectrogram(args) -> None:
        audio = Audio.load(args.audio)
        img = audio.spectrogram()
        img.save(args.output)
    pp.set_defaults(func=spectrogram)

    pp = sp.add_parser("pitch",
                       help="analyze the pitch of the audio file")
    pp.add_argument("audio", help="input audio file")
    pp.add_argument("output", help="output CSV file")
    def pitch(args) -> None:
        audio = Audio.load(args.audio)
        data = audio.pitch()
        with open(args.output, "w") as fp:
            for x in data:
                print(x, file=fp)
    pp.set_defaults(func=pitch)

    args = p.parse_args()
    args.func(args)

if __name__ == "__main__":
    main()
