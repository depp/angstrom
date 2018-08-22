import argparse
import pathlib

from . import audio
from . import encode

def main():
    p = argparse.ArgumentParser(allow_abbrev=False)
    p.add_argument("script", help="phoneme script")
    p.add_argument("-dir", help="phoneme library",
                   required=True)
    p.add_argument("output", help="output Opus file")
    args = p.parse_args()

    stream = encode.Stream()
    phones = {}
    for path in pathlib.Path(args.dir).glob("*.wav"):
        try:
            phone = audio.Audio.load(path)
            packet = encode.Packet(phone.data)
            n = stream.encode_packet(packet)
            phones[path.stem] = (n, len(phone.data))
        except Exception:
            print("Error loading", path)
            raise

    with open(args.script) as fp:
        for lineno, line in enumerate(fp, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            for field in line.split():
                i = field.find(".")
                if i >= 0:
                    phone = field[:i]
                    count = int(field[i+1:])
                else:
                    phone = field
                    count = 1
                try:
                    n, sz = phones[phone]
                except KeyError:
                    print("Error: Missing phone: {!r}".format(phone))
                    raise SystemExit(1)
                for _ in range(count):
                    stream.emit_packet(n)

    stream.encode(args.output)

if __name__ == "__main__":
    main()
