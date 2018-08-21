import io
import json
import math
import os
import pathlib
import sys

import flask
import numpy
import matplotlib
import werkzeug.exceptions as exceptions

from . import js
from . import project

from typing import Dict, List, Optional, Tuple

matplotlib.use("svg")

import matplotlib.pyplot as pyplot

ROOT = pathlib.Path(__file__).resolve().parent.parent

app = flask.Flask(__name__)
app.config["PROJECT"] = os.environ.get("PROJECT")

PROJECT_DATA: Optional[project.Project] = None
def get_project() -> project.Project:
    global PROJECT_DATA
    if PROJECT_DATA is None:
        p = project.Project(pathlib.Path(app.config["PROJECT"]))
        p.load()
        PROJECT_DATA = p
    return PROJECT_DATA

SCRIPT_DATA = None
def get_script(*, rebuild=False):
    global SCRIPT_DATA
    if SCRIPT_DATA is not None and rebuild and SCRIPT_DATA.is_outdated():
        print("Script is outdated", file=sys.stderr)
        SCRIPT_DATA = None
    if SCRIPT_DATA is None:
        print("Compiling script", file=sys.stderr)
        try:
            SCRIPT_DATA = js.Script.compile()
        except js.CompilationError as ex:
            print("Error:", ex)
            sys.stderr.write(ex.details)
            raise exceptions.InternalServerError(str(ex))
        sys.stderr.write(SCRIPT_DATA.errors)
    return SCRIPT_DATA

@app.route("/")
def main():
    return flask.redirect("/static/edit.html")

@app.route("/edit.js")
def edit_js():
    script = get_script(rebuild=True)
    return flask.Response(script.js, mimetype="application/javascript")

@app.route("/edit.js.map")
def edit_js_map():
    script = get_script()
    return flask.Response(script.jsmap, mimetype="application/json")

CONTENT_TYPES = {
    ".js": "application/javascript",
    ".css": "text/css",
}

NODE_FILES = {
    "jquery.js": "jquery/dist/jquery.js",
    "popper.js": "popper.js/dist/umd/popper.js",
    "bootstrap.js": "bootstrap/dist/js/bootstrap.js",
    "vue.js": "vue/dist/vue.js",
    "vue-router.js": "vue-router/dist/vue-router.js",
    "bootstrap.css": "bootstrap/dist/css/bootstrap.css",
    "bootstrap-vue.css": "bootstrap-vue/dist/bootstrap-vue.css",
    "bootstrap-vue.js": "bootstrap-vue/dist/bootstrap-vue.js",
}

@app.route("/node/<path:subpath>")
def node_file(subpath) -> flask.Response:
    relpath = NODE_FILES.get(subpath)
    if relpath is None:
        raise exceptions.NotFound()
    fpath = pathlib.Path(ROOT, "node_modules", relpath)
    ctype = CONTENT_TYPES[fpath.suffix]
    return flask.Response(fpath.read_bytes(), mimetype=ctype)

def pop_str(args: Dict[str, List[str]], name: str, default: str) -> str:
    s = args.pop(name, None)
    if s is None:
        return default
    return s[-1]

def pop_int(args: Dict[str, List[str]], name: str, default: int) -> int:
    s = args.pop(name, None)
    if s is None:
        return default
    try:
        return int(s[-1])
    except ValueError:
        raise exceptions.BadRequest("Invalid parameter {!r}".format(name))

def pop_float(args: Dict[str, List[str]], name: str, default: float) -> float:
    s = args.pop(name, None)
    if s is None:
        return default
    try:
        return float(s[-1])
    except ValueError:
        raise exceptions.BadRequest("Invalid parameter {!r}".format(name))

def pop_float_pair(args: Dict[str, List[str]], name: str,
                   default: Tuple[float, float]) -> Tuple[float, float]:
    s = args.pop(name, None)
    if s is None:
        return default
    try:
        s0, s1 = s[-1].split(",")
        return float(s0), float(s1)
    except ValueError:
        raise exceptions.BadRequest("Invalid parameter {!r}".format(name))

def pop_figsize(args: Dict[str, List[str]],
                default: Tuple[float, float]) -> Tuple[float, float]:
    figsize = args.pop("figsize", None)
    if figsize is None:
        return default
    try:
        ws, hs = figsize[-1].split(",")
        wf = float(ws)
        hf = float(hs)
    except ValueError:
        raise exceptions.BadRequest("Invalid figsize")
    if wf < 0 or hf < 0:
        raise exceptions.BadRequest("Figsize out of range")
    return wf, hf

@app.route("/data")
def audiodata() -> flask.Response:
    audio = get_audio()
    return flask.Response(audio.tobytes(), mimetype="application/octet-stream")

@app.route("/spectrogram")
def spectrogram() -> flask.Response:
    args = dict(flask.request.args)
    step = pop_int(args, "step", 240)
    if step <= 0:
        raise exceptions.BadRequest("Step size must be positive")
    bins = pop_int(args, "bins", 1024)
    if bins <= 0:
        raise exceptions.BadRequest("Bin count must be positive")
    dbrange = pop_float_pair(args, "dbrange", (-120, -40))
    if not (dbrange[0] < dbrange[1]):
        raise exceptions.BadRequest("Invalid dbrange")
    if args:
        raise exceptions.BadRequest("Unknown parameters: {}".format(
                                    ", ".join(args)))

    audio = get_audio()
    img = audio.spectrogram(step=step, bins=bins, dbrange=dbrange)
    fp = io.BytesIO()
    img.save(fp, format="png")
    return flask.Response(fp.getvalue(), mimetype="image/png")

@app.route("/level")
def level() -> flask.Response:
    args = dict(flask.request.args)
    step = pop_int(args, "step", 240)
    if step <= 0:
        raise exceptions.BadRequest("Step size must be positive")
    wsize = pop_int(args, "wsize", 1024)
    if wsize <= 0:
        raise exceptions.BadRequest("Window size must be positive")
    ctype = pop_str(args, "type", "svg")
    if ctype == "svg":
        figsize = pop_figsize(args, (10, 3))
        def result(level: numpy.ndarray) -> flask.Response:
            pyplot.figure(figsize=figsize)
            x = (numpy.arange(len(level)).astype(numpy.float32) *
                 (step / audio.FREQUENCY))
            y = numpy.log(level) * (20 / math.log(10))
            pyplot.plot(x, y)
            fp = io.StringIO()
            pyplot.savefig(fp)
            return flask.Response(fp.getvalue(), mimetype="image/svg+xml")
    elif ctype == "csv":
        def result(level: numpy.ndarray) -> flask.Response:
            fp = io.StringIO()
            for x in level:
                print(x, file=fp)
            return flask.Response(fp.getvalue(), mimetype="text/csv")
    else:
        raise exceptions.BadRequest("unknown type")
    if args:
        raise exceptions.BadRequest("Unknown parameters: {}".format(
                                    ", ".join(args)))

    audio = get_audio()
    level = audio.level(window_size=wsize)
    level = level[::step]
    return result(level)

@app.route("/pitch")
def pitch() -> flask.Response:
    args = dict(flask.request.args)
    step = pop_int(args, "step", 240)
    if step <= 0:
        raise exceptions.BadRequest("Step size must be positive")
    freq = pop_float_pair(args, "float", (80.0, 260.0))
    if not (freq[0] < freq[1]):
        raise exceptions.BadRequest("Invalid freq")
    amin = pop_float(args, "amin", -40)
    cmin = pop_float(args, "cmin", -10)
    ctype = pop_str(args, "type", "svg")
    if ctype == "svg":
        figsize = pop_float_pair(args, "size", (10, 3))
        if figsize[0] <= 0 or figsize[1] <= 0:
            raise exceptions.BadRequest("Invalid size")
        def result(pitch: numpy.ndarray) -> flask.Response:
            pyplot.figure(figsize=figsize)
            x = (numpy.arange(len(pitch)).astype(numpy.float32) *
                 (step / audio.FREQUENCY))
            pyplot.plot(x, pitch)
            fp = io.StringIO()
            pyplot.savefig(fp)
            return flask.Response(fp.getvalue(), mimetype="image/svg+xml")
    elif ctype == "csv":
        def result(pitch: numpy.ndarray) -> flask.Response:
            fp = io.StringIO()
            for x in zip(time, pitch):
                print(x, file=fp)
            return flask.Response(fp.getvalue(), mimetype="text/csv")
    else:
        raise exceptions.BadRequest("Unknown type")
    if args:
        raise exceptions.BadRequest("Unknown parameters: {}".format(
                                    ", ".join(args)))

    audio = get_audio()
    pitch = audio.pitch(
        step=step,
        freq_range=freq,
        audio_threshold=amin,
        corr_threshold=cmin,
    )
    return result(pitch)

@app.route("/input")
def inputs() -> flask.Response:
    proj = get_project()
    data = [
        {"url": clip.ident,
         "name": clip.name}
        for clip in proj.inputs.values()
    ]
    data.sort(key=lambda x: x["name"])
    return flask.Response(json.dumps(data), mimetype="application/json")

@app.route("/input/<name>")
def input_info(name: str) -> flask.Response:
    proj = get_project()
    clip = proj.inputs.get(name)
    if clip is None:
        raise exceptions.NotFound()
    data = {"url": clip.ident,
            "name": clip.name}
    return flask.Response(json.dumps(data), mimetype="application/json")
