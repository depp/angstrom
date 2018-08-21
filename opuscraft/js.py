import io
import json
import os
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent

class CompilationError(Exception):
    def __init__(self, msg, details):
        super().__init__(msg)
        self.details = details

class Script:
    def __init__(self, js, jsmap, inputs, errors):
        self.js = js
        self.jsmap = jsmap
        self.inputs = inputs
        self.errors = errors

    def is_outdated(self):
        """Return true if the script is outdated and should be rebuilt."""
        for path, mtime in self.inputs:
            try:
                st = pathlib.Path(ROOT, path).stat()
            except FileNotFoundError:
                return True
            if st.st_mtime != mtime:
                return True
        return False

    @classmethod
    def compile(class_):
        tsc = pathlib.Path("node_modules/.bin/tsc")
        tsconfig = pathlib.Path("script/tsconfig.json")
        tssrcs = []
        rollup = pathlib.Path("node_modules/.bin/rollup")
        rollupconfig = pathlib.Path("script/rollup.config.js")

        input_paths = [tsconfig, rollupconfig]
        input_paths.extend(
            path.relative_to(ROOT)
            for path in pathlib.Path(ROOT, "script").rglob("*.ts"))

        with tempfile.TemporaryDirectory("angstrom") as dname:
            # Symlink all sources in target directory.
            dpath = pathlib.Path(dname)
            pathlib.Path(dpath, "node_modules").symlink_to(
                pathlib.Path(ROOT, "node_modules"))
            dirs = {pathlib.Path(".")}
            def mkdir(path):
                if path in dirs:
                    return
                assert not path.is_absolute()
                mkdir(path.parent)
                pathlib.Path(dpath, path).mkdir()
                dirs.add(path)
            mtimes = {}
            for path in input_paths:
                mkdir(path.parent)
                src = pathlib.Path(ROOT, path)
                pathlib.Path(dpath, path).symlink_to(src)
                mtimes[path] = src.stat().st_mtime

            cmd = [
                str(tsc),
                "--project", str(tsconfig),
                "--sourceMap",
                "--listFiles",
                "--pretty",
                "--target", "ES2015",
                "--moduleResolution", "node",
            ]
            out = subprocess.run(
                cmd,
                cwd=dname,
                executable=str(tsc),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                encoding="UTF-8",
            )
            tsinputs = []
            errors = io.StringIO()
            for line in out.stdout.splitlines():
                if line.startswith("/"):
                    tsinputs.append(line)
                else:
                    errors.write(line)
                    errors.write("\n")
            if out.returncode != 0:
                raise CompilationError("tsc failed", errors.getvalue())
            inputs = [(tsconfig, mtimes[tsconfig])]
            for path in out.stdout.splitlines():
                path = pathlib.Path(path)
                try:
                    path = path.relative_to(dpath)
                except ValueError:
                    try:
                        path = path.relative_to(ROOT)
                    except ValueError:
                        raise Exception("invalid dependency: {!r}"
                                        .format(str(path)))
                mtime = mtimes.get(path)
                if mtime is None:
                    mtime = pathlib.Path(ROOT, path).stat().st_mtime
                inputs.append((path, mtime))

            with pathlib.Path(dpath, "script/main.js").open() as fp:
                import sys
                sys.stdout.write(fp.read())
            cmd = [
                str(rollup),
                "--config", str(rollupconfig),
            ]
            out = subprocess.run(
                cmd,
                cwd=dname,
                executable=str(rollup),
                stdin=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                encoding="UTF-8",
            )
            errors.write(out.stderr)
            if out.returncode != 0:
                raise CompilationError("rollup failed", errors.getvalue())
            bundle_js = pathlib.Path(dpath, "edit.js")
            bundle_jsmap = pathlib.Path(dpath, "edit.js.map")

            with bundle_jsmap.open() as fp:
                mapdata = json.load(fp)
            mapdata["sourceRoot"] = str(ROOT)

            return class_(
                bundle_js.read_bytes(),
                json.dumps(mapdata, separators=(",", ":"), sort_keys=True)
                .encode("UTF-8"),
                inputs,
                errors.getvalue(),
            )

def main():
    import sys
    try:
        script = Script.compile()
    except CompilationError as ex:
        print("Error:", ex, file=sys.stderr)
        sys.stderr.write(ex.details)
        raise SystemExit(1)
    print("===== edit.js =====")
    print(script.js.decode("UTF-8"))
    print("===== edit.js.map =====")
    print(script.jsmap.decode("UTF-8"))
    print("===== stats =====")
    print("Outdated:", script.is_outdated())
    for path, _ in script.inputs:
        print("Input:", path)

if __name__ == "__main__":
    main()
