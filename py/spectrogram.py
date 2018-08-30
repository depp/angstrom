import math

import numpy
import PIL.Image
import scipy.signal

def palette_from_rgb(rgb):
    """Create a palette for Pillow from a floating-point RGB array.

    Arguments:
       rgb: Floating-point array with shape (3,N) and values in range [0,1].
            The red, green, and blue channels are rgb[0], rgb[1], and rgb[2].

    Returns: A uint8 array containing repeated R,G,B tuples with values in the
             range [0,255].
    """
    return numpy.clip(rgb * 256, 0, 255).astype(numpy.uint8).flatten("F")

def rgb_from_hsl(hsl):
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

def color_ramp():
    """Create a color ramp for displaying spectrogram data.

    Returns: A uint8 array with size 256*3 for use with Pillow as a palette.
    """
    return palette_from_rgb(rgb_from_hsl(numpy.array(
        [numpy.linspace(-90, +90, 256, numpy.float32),
         numpy.full((256,), 1.0, numpy.float32),
         numpy.linspace(0, 1, 256, numpy.float32)],
        dtype=numpy.float32)))

def data_segments(data, step, nsamp):
    """Split an ndarray into potentially overlapping segments."""
    return numpy.lib.stride_tricks.as_strided(
        data,
        shape=(data.shape[:-1] +
               ((data.shape[-1] + step - nsamp) // step, nsamp)),
        strides=(data.strides[:-1] +
                 (step * data.strides[-1], data.strides[-1])),
        writeable=False,
    )

def spectrogram(data, step=240, bins=1024, dbrange=(-120.0, -40.0)):
    """Create a spectrogram of the audio clip.

    Arguments:
      step: Number of audio samples per horizontal pixel.
      bins: Number of FFT bins to use.
      dbrange: The (min,max) range for signal levels.

    Returns: A PIL image of the audio spectrogram.
    """
    f, t, s = scipy.signal.spectrogram(
        data,
        48000,
        nperseg=bins,
        noverlap=(bins - step),
        window="blackman",
        mode="magnitude",
    )
    s = s[::-1]
    min_db, max_db = dbrange
    db_to_image = 256 / (max_db - min_db)
    s = (numpy.log(s) * (db_to_image * 20 / math.log(10)) -
         min_db * db_to_image)
    s = numpy.clip(s, 0, 255).astype(numpy.uint8)
    img = PIL.Image.fromarray(s.astype(numpy.uint8), "L")
    img.putpalette(color_ramp())
    return img

def main():
    import argparse
    import sys

    p = argparse.ArgumentParser(allow_abbrev=False)
    p.add_argument("-step", type=int, default=240,
                   help="number of samples per column")
    p.add_argument("-bins", type=int, default=1024,
                   help="number of bins")
    p.add_argument("-min-db", type=float, default=-120.0,
                   help="minimum dB level in range")
    p.add_argument("-max-db", type=float, default=-40.0,
                   help="maximum dB level in range")
    args = p.parse_args()

    data = (numpy.frombuffer(sys.stdin.buffer.read(), numpy.int16)
            .astype(numpy.float)
            * 2**-15)
    img = spectrogram(
        data,
        step=args.step,
        bins=args.bins,
        dbrange=(args.min_db, args.max_db),
    )
    img.save(sys.stdout.buffer, format="png")

if __name__ == "__main__":
    main()
