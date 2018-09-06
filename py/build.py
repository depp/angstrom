import datetime
import io
import json
import os
import pathlib
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib

from typing import List

TIME = datetime.datetime(2018, 9, 13, 13, 0, 0)

def msdosDate(t):
    return (
        ((t.year - 1980) << 9) |
        (t.month << 5) |
        t.day,
        (t.hour << 11) |
        (t.minute << 5) |
        (t.second >> 1),
    )

LIMIT = 13 * 1024

def print_size(sz: int, name: str) -> None:
    print("    {:8}  {:8.2f}  {}".format(sz, 100 * sz / LIMIT, name),
          file=sys.stderr)

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent

HTML = """\
<meta charset=utf-8>\
<canvas id=g width=800 height=600></canvas>\
<script>\
"""

def build_html() -> bytes:
    print("Building HTML", file=sys.stderr)
    out = subprocess.run(
        ["node", "game/cyber/compile.js", "--config=release", "--no-minify"],
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        check=True,
    )
    data = json.loads(out.stdout)
    fatalError = False
    for obj in data["diagnostics"]:
        print("{}:".format(obj["file"] or "build"))
        for msg in obj["messages"]:
            lineno = msg.get("line")
            colno = msg.get("column")
            if not lineno:
                prefix = "  "
            elif not colno:
                prefix = "  {}: ".format(lineno)
            else:
                prefix = "  {}:{}: ".format(lineno, colno)
            if msg["severity"] >= 2:
                severity = "error"
            else:
                severity ="warning"
            print("{}{}: {}".format(prefix, severity, msg["message"]),
                  file=sys.stderr)
            if msg["fatal"]:
                fatalError = True
    if fatalError:
        print("error: compilation failed", file=sys.stderr)
        raise SystemExit(1)
    code = data["code"]
    return (HTML + code + "</script>").encode("UTF-8")

class File:
    def __init__(self, name: str, data: bytes, cdata: bytes) -> None:
        self.name = name
        self.data = data
        self.cdata = cdata

class FileSet:
    zippath: pathlib.Path
    filepath: pathlib.Path
    files: List[File]
    body: io.BytesIO
    directory: io.BytesIO

    def __init__(self, zippath: pathlib.Path, filepath: pathlib.Path) -> None:
        self.zippath = zippath
        self.filepath = filepath
        self.files = []
        self.body = io.BytesIO()
        self.directory = io.BytesIO()

    def add(self, name: str, data: bytes) -> None:
        fpath = self.filepath / name
        fpath.write_bytes(data)
        out = subprocess.run(
            ["zopfli", "-c", "--i50", "--deflate", str(fpath)],
            stdout=subprocess.PIPE,
            check=True,
        )
        cdata = out.stdout
        self.files.append(File(name, data, cdata))
        bname = name.encode("ASCII")
        pos = self.body.tell()
        crc = zlib.crc32(data)
        date, time = msdosDate(TIME)
        self.body.write(struct.pack(
            "<IHHHHHIIIHH",
            0x04034b50, # signature
            20, # version needed
            0, # flags
            8, # compression method
            time, # mod time
            date, # mod date
            crc, # crc-32
            len(cdata), # compressed size
            len(data), # uncompressed size
            len(bname), # file name length
            0, # extra field length
        ))
        self.body.write(bname)
        self.body.write(cdata)
        self.directory.write(struct.pack(
            "<IHHHHHHIIIHHHHHII",
            0x02014b50, # signature
            20, # version made by
            20, # version needed
            0, # flags
            8, # compression method
            time, # mod time
            date, # mod date
            crc, # crc-32
            len(cdata), # compressed size
            len(data), # uncompressed size
            len(bname), # file name length
            0, # extra field length
            0, # file comment length
            0, # disk number start
            0, # internal file attributes
            0, # external file attributes
            pos, # relative offset
        ))
        self.directory.write(bname)

    def save(self) -> None:
        end = struct.pack(
            "<IHHHHIIH",
            0x06054b50,
            0, # multi-disk
            0, # multi-disk
            len(self.files), # directory entry count
            len(self.files), # directory entry count
            self.directory.tell(), # directory size
            self.body.tell(), # directory offset
            0, # comment length
        )
        with self.zippath.open("wb") as fp:
            fp.write(self.body.getvalue())
            fp.write(self.directory.getvalue())
            fp.write(end)
            zipsize = fp.tell()
        print("    Size (B)  Size (%)  Name", file=sys.stderr)
        overhead = zipsize
        for file in self.files:
            overhead -= len(file.cdata)
            print_size(len(file.cdata), file.name)
        print_size(overhead, "ZIP overhead")
        print_size(zipsize, "Total")

    def test(self) -> None:
        with tempfile.TemporaryDirectory("angstrom") as d:
            subprocess.run(
                ['unzip', str(self.zippath)],
                cwd=d,
                check=True,
            )
            for file in self.files:
                data = pathlib.Path(d, file.name).read_bytes()
                if data != file.data:
                    print("error: data mismatch (file={!r})".format(file.name))
                    raise SystemExit(1)

def main() -> None:
    print("Building", file=sys.stderr)
    html = build_html()

    print("Compressing", file=sys.stderr)
    builddir = ROOT_DIR / "build"
    try:
        shutil.rmtree(builddir)
    except FileNotFoundError:
        pass
    builddir.mkdir(parents=True)
    filedir = builddir / "files"
    filedir.mkdir()
    fs = FileSet(builddir / "js13k.zip", filedir)
    fs.add("index.html", html)
    fs.save()

    print("Testing", file=sys.stderr)
    fs.test()
    print("ok")

if __name__ == "__main__":
    main()
