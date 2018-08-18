import io
import math
import os

import flask
import numpy
import PIL.Image
import scipy.signal
import matplotlib

from . import load

matplotlib.use("svg")

import matplotlib.pyplot as pyplot

app = flask.Flask(__name__)
app.config["AUDIO_FILE"] = os.environ.get("AUDIO_FILE")

def round_up_pow2(x):
    x -= 1
    x |= x >> 1
    x |= x >> 2
    x |= x >> 4
    x |= x >> 8
    x |= x >> 16
    x += 1
    return x

def get_audio():
    if "audio" not in flask.g:
        flask.g.audio = load.load_audio(app.config["AUDIO_FILE"])
    return flask.g.audio

@app.route("/")
def main():
    fp = io.StringIO()
    for k, v in app.config.items():
        print("{}={!r}".format(k, v), file=fp)
    return flask.Response(fp.getvalue(), mimetype="text/plain;charset=UTF-8")

def palette_from_rgb(rgb):
    return numpy.clip(rgb * 256, 0, 255).astype(numpy.uint8).flatten("F")

def rgb_from_hsl(hsl):
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
    return palette_from_rgb(rgb_from_hsl(numpy.array(
        [numpy.linspace(-90, +90, 256, numpy.float32),
         numpy.full((256,), 1.0, numpy.float32),
         numpy.linspace(0, 1, 256, numpy.float32)],
        dtype=numpy.float32)))

@app.route("/spectrogram")
def spectrogram():
    audio = get_audio()
    step = round(48000 * 5e-3)
    nsample = 1024
    assert nsample >= step
    f, t, s = scipy.signal.spectrogram(
        audio,
        48000,
        nperseg=nsample,
        noverlap=(nsample - step),
        window="blackman",
        mode='magnitude')
    s = s[::-1]
    min_db = -120
    max_db = -40
    db_to_image = 256 / (max_db - min_db)
    s = (numpy.log(s) * (db_to_image * 20 / math.log(10)) -
         min_db * db_to_image)
    print("PERCENTILE", numpy.percentile(s, [0, 1, 5, 50, 95, 99, 100]))
    s = numpy.clip(s, 0, 255).astype(numpy.uint8)
    # s[:,0:10] = numpy.linspace(0, 255, 513, numpy.uint8)[:,None]
    img = PIL.Image.fromarray(s.astype(numpy.uint8), "L")
    img.putpalette(color_ramp())
    fp = io.BytesIO()
    img.save(fp, format="png")
    return flask.Response(fp.getvalue(), mimetype="image/png")

def dilate(a, n):
    c, = a.shape
    z = numpy.zeros((n+1,), numpy.int32)
    s = numpy.cumsum(numpy.concatenate([z, a.astype(numpy.int32), z]))
    return s[1+2*n:1+2*n+c] > s[0:c]

def erode(a, n):
    return numpy.logical_not(dilate(numpy.logical_not(a), n))

def data_segments(data, step, nsamp):
    return numpy.lib.stride_tricks.as_strided(
        data,
        shape=(data.shape[:-1] +
               ((data.shape[-1] + step - nsamp) // step, nsamp)),
        strides=(data.strides[:-1] +
                 (step * data.strides[-1], data.strides[-1])),
        writeable=False,
    )

@app.route("/pitch")
def pitch():
    audio = get_audio()
    # Sample rate
    fs = 48000
    # Time step for analysis
    tstep = 5e-3
    # Frequency range we care about
    fmin = 80
    fmax = 260
    # Minimum signal level for pitch detection
    pmin = -30
    pmin2 = -30
    # Trigger time for activity detection
    trig = 20e-3

    step = round(fs * tstep)
    mag2min = 0.5 * 10**(pmin*0.1)

    # Window size: must be at least one period of lowest frequency we care
    # about, plus a margin. Then we need an additional number of zeroes equal to
    # the period of the lowest frequency, for autocorrelation to work.
    wsize = round(fs * 2 / fmin)
    nzero = round(fs / fmin)
    nsamp = wsize + nzero
    window = scipy.signal.windows.blackman(wsize).astype(numpy.float32)
    wsum = numpy.sum(window)

    # Calculate the signal level with the same window size we use for pitch
    # detection.
    mag2 = scipy.signal.fftconvolve(numpy.square(audio), window)
    mag2 = mag2[(wsize-1)//2:(wsize-1)//2+audio.shape[0]]
    mag2 *= 2.0 / wsum
    level_db = numpy.log(mag2) * (10 / math.log(10))
    active = level_db >= pmin
    trig_nsamp = round(trig * fs)
    active = erode(dilate(active, trig_nsamp), trig_nsamp)

    # Break audio into segments.
    segments = data_segments(audio, step, nsamp)
    nseg = segments.shape[0]
    corr = numpy.empty((nseg, nzero+1), numpy.float32)
    window = numpy.concatenate([window, numpy.zeros((nzero,), numpy.float32)])
    for i, seg in enumerate(segments):
        corr[i] = (scipy.signal.convolve(
            seg * window, seg[::-1]))[nsamp-1:nsamp+nzero]
    corr *= 1.0 / wsum

    # Find autocorrelation peaks.
    i0 = round(fs / fmax)
    i1 = round(fs / fmin)
    peakidx = numpy.argmax(corr[:,i0:i1+1], axis=1) + i0
    peakstr = corr[numpy.arange(corr.shape[0]),peakidx]
    haspitch = peakstr >= 10**(pmin2 * 0.1)

    # TODO: what we want is autocorrelation of t0 and t1, where we then
    # divide by the

    pyplot.figure(figsize=(10, 10))

    pyplot.subplot(411)
    pyplot.plot(segments[30])

    pyplot.subplot(412)
    for i in range(50, 55):
        pyplot.plot(corr[i])

    pyplot.subplot(413)
    pitch = fs / peakidx
    pitch[numpy.where(numpy.logical_not(haspitch))] = numpy.nan
    pyplot.plot(pitch)
    # pyplot.plot(active[::step].astype(numpy.int32) * 200)

    pyplot.subplot(414)
    pyplot.plot(numpy.log(peakstr) * (10 / math.log(10)))
    pyplot.plot(haspitch.astype(numpy.int32) * 20 - 40)

    fp = io.StringIO()
    pyplot.savefig(fp)
    return flask.Response(
        fp.getvalue(),
        mimetype="image/svg+xml")

    fp = io.StringIO()
    for x in mag2[:,0]:
        print(x > mag2min, file=fp)

    return flask.Response(
        fp.getvalue(),
        mimetype="text/plain;charset=UTF-8")
