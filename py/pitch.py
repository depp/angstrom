import sys

SCALE = {
    "C": 0,
    "D": 2,
    "E": 4,
    "F": 5,
    "G": 7,
    "A": 9,
    "B": 11,
}

SCALE_INV = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

def midi_from_sci(name):
    if not isinstance(name, str):
        raise TypeError("pitch must be string")
    if not name:
        raise ValueError("invalid pitch")
    try:
        npitch = SCALE[name[:1].upper()]
    except KeyError:
        raise ValueError("invalid pitch")
    name = name[1:]
    if name.startswith("#"):
        name = name[1:]
        npitch += 1
    elif name.startswith("b"):
        name = name[1:]
        npitch -= 1
    if not name:
        raise ValueError("invalid pitch")
    try:
        noctave = int(name)
    except ValueError:
        raise ValueError("invalid pitch")
    return npitch + 12*(noctave-4) + 60

def sci_from_midi(n):
    noctave, npitch = divmod(n - 60, 12)
    if npitch < 0:
        npitch += 12
        noctave -= 1
    return "{}{}".format(SCALE_INV[npitch], noctave + 4)

def hz_from_midi(n):
    return 440 * 2**((n - 69) / 12)

def main():
    while True:
        try:
            x = input("pitch> ")
        except EOFError:
            return
        except KeyboardInterrupt:
            return
        try:
            midi = midi_from_sci(x)
        except ValueError as ex:
            print("Error:", ex, file=sys.stderr)
            continue
        print("Pitch:", sci_from_midi(midi))
        print("MIDI:", midi),
        print("Frequency:", hz_from_midi(midi), "Hz")

if __name__ == "__main__":
    main()
