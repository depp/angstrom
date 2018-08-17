import io
import math
import os

import flask
import numpy
import PIL.Image
import scipy.signal

from . import load

app = flask.Flask(__name__)
app.config["AUDIO_FILE"] = os.environ["AUDIO_FILE"]

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
    bins = 1024
    f, t, s = scipy.signal.spectrogram(
        audio,
        48000,
        nperseg=bins,
        noverlap=bins // 2,
        window=("tukey", 0.5),
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
