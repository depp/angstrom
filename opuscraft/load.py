import os
import subprocess

import numpy

def load_audio(path):
    with open(path, 'rb') as fp:
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
                "rate", "48k",
            ],
            stdin=fp,
            stdout=subprocess.PIPE,
            check=True,
        )
    return numpy.frombuffer(out.stdout, dtype=numpy.float32)

if __name__ == "__main__":
    import sys
    print(load_audio(sys.argv[1]))
