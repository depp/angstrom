import json
import os
import sys

import numpy

from . import analyze
from . import audio

from abc import ABCMeta, abstractmethod
from typing import (
    Any, Dict, Iterable, Iterator, List, Optional, Set, Tuple,
)

class ScriptError(Exception):
    """Script execution error."""
    def __init__(self, msg: str,
                 filename: Optional[str] = None,
                 lineno: Optional[int] = None) -> None:
        super().__init__(msg)
        self.filename = filename
        self.lineno = lineno

class State:
    """The state of the script executor.

    Attributes:
      base_path: Path to directory containing script.
      sounds: Map from sound name to individual sounds.
      groups: List of groups being executed, outermost first.
    """
    base_path: str
    sounds: Dict[str, Optional["Sound"]]
    groups: List["Group"]

    def __init__(self, base_path: str) -> None:
        self.base_path = base_path
        self.sounds = {}
        self.groups = []

    def run(self, lines: Iterable[str]) -> None:
        for lineno, line in enumerate(lines, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            cmd_name, *args = line.split()
            if cmd_name == '.':
                func_name = 'command'
            else:
                func_name = 'command_' + cmd_name
            group: Any = self
            if self.groups:
                group = self.groups[-1]
            func = getattr(group, func_name, None)
            if func is None:
                raise ScriptError("Unknown command {!r}".format(cmd_name),
                                  lineno=lineno)
            try:
                func(args)
            except ScriptError as ex:
                ex.lineno = lineno
                raise
            except Exception:
                print("At line {}".format(lineno), file=sys.stderr)
                raise
        if self.groups:
            raise ScriptError("Unclosed group: {}"
                              .format(self.groups[-1].__class__.__name__),
                              lineno=lineno)

    def command_input(self, args: List[str]) -> None:
        try:
            path, = args
        except ValueError:
            raise ScriptError("Invalid input command")
        data = audio.load_audio(os.path.join(self.base_path, path))
        self.groups.append(InputGroup(self, data))

    def command_word(self, args: List[str]) -> None:
        try:
            name, = args
        except ValueError:
            raise ScriptError("Invalid word command")
        if name in self.sounds:
            raise ScriptError("Duplicate sound name {!r}".format(name))
        self.sounds[name] = None
        self.groups.append(WordGroup(self, name))

    def command_output(self, args: List[str]) -> None:
        try:
            path, = args
        except ValueError:
            raise ScriptError("Invalid output command")
        self.groups.append(OutputGroup(self, path))

################################################################################
# Groups
################################################################################

class Group(metaclass=ABCMeta):
    """Abstract base class for groups of statements in the input script."""

    def __init__(self, state: State) -> None:
        self.state = state

    def command_end(self, args: List[str]) -> None:
        if args:
            raise ScriptError("Unexpected argument")
        self.state.groups.pop()

class InputGroup(Group):
    """A group in the input script which extracts sounds from an input file.

    Attributes:
      sounds: Sounds to add the input to.
      data: Audio clip data, a 48 kHz float32 NumPy array.
    """

    def __init__(self, state: State, data: numpy.ndarray) -> None:
        super().__init__(state)
        self.data = data

    def command(self, args: List[str]) -> None:
        try:
            name, sstart, slength, method, *args = args
            start = round(float(sstart) * 48)
            length = round(float(slength) * 48)
        except ValueError:
            raise ScriptError("Invalid sound")
        if name in self.state.sounds:
            raise ScriptError("Duplicate sound {!r}".format(name))
        func = getattr(self, "add_sound_" + method, None)
        if func is None:
            raise ScriptError("Unknown method {!r}".format(method))
        sound = func(name, start, length, args)
        assert sound
        self.state.sounds[name] = sound

    def get_sound(self, start: int, length: int) -> List[audio.Packet]:
        try:
            clip = analyze.extract_clip(self.data, start, length)
        except ValueError as ex:
            raise ScriptError(str(ex))
        pos = 0
        packets: List[audio.Packet] = []
        for length in packetize(length):
            packets.append(audio.AudioPacket(
                clip[pos:pos+length],
                independent=not packets))
            pos += length
        return packets

    def add_sound_once(self, name: str, start: int, length: int,
                      args: List[str]) -> "Sound":
        if args:
            raise ScriptError("Unexpected sound parameter")
        return OnceSound(self.get_sound(start, length))

    def add_sound_looped(self, name: str, start: int, length: int,
                        args: List[str]) -> "Sound":
        if args:
            raise ScriptError("Unexpected sound parameter")
        return LoopedSound(self.get_sound(start, length))

    def add_sound_pitched(self, name: str, start: int, length: int,
                         args: List[str]) -> "Sound":
        try:
            ssizes, = args
        except ValueError:
            raise ScriptError("Expected one sound parameter")
        sizes: List[int] = []
        for ssize in ssizes.split(","):
            i = ssize.find('x')
            try:
                if i == -1:
                    n = 1
                    v = int(ssize)
                else:
                    n = int(ssize[:i])
                    v = int(ssize[i+1:])
            except ValueError:
                raise ScriptError("Invalid segment size {!r}".format(ssize))
            if n <= 0 or v <= 0:
                raise ScriptError("Invalid segment size {!r}".format(ssize))
            v *= 48
            sizes.extend(v for _ in range(n))
        if sum(sizes) > length:
            raise ScriptError("Segments are larger than enclosing clip")
        pgroups = [list(packetize(size)) for size in sizes]
        extra = sum(length for pgroup in pgroups for length in pgroup)
        pos = 0
        groups = []
        for n, pgroup in enumerate(pgroups):
            glen = sum(pgroup)
            gpos = start + pos + (n+1)*extra//(len(pgroups)+1)
            clip = analyze.extract_pitched(name, self.data, gpos, glen)
            ppos = 0
            group: List[audio.Packet] = []
            for length in pgroup:
                group.append(audio.AudioPacket(
                    clip[ppos:ppos+length],
                    independent=not group))
                ppos += length
            groups.append(group)
            pos += glen
        return StretchPitchSound(groups)

class StreamGroup(Group):
    def __init__(self, state: State, stream: audio.Stream) -> None:
        super().__init__(state)
        self.stream = stream

    def command(self, args: List[str]) -> None:
        if not (1 <= len(args) <= 2):
            raise ScriptError("Expected 1 or 2 arguments")
        name = args[0]
        try:
            sound = self.state.sounds[name]
        except KeyError:
            raise ScriptError("Undefined sound {!r}".format(name))
        if sound is None:
            raise ScriptError("Cannot recursively use sound {!r}".format(name))
        length: Optional[int] = None
        if len(args) == 2 and args[1] != "-":
            try:
                length = int(args[1])
            except ValueError:
                raise ScriptError("Invalid length")
            length *= 48
        sound.emit(self.stream, length)

class WordGroup(StreamGroup):
    """A sequence of sounds in the script which can be reused as a unit."""

    def __init__(self, state: State, name: str) -> None:
        super().__init__(state, audio.Stream())
        self.name = name
        self.stream = audio.Stream()

    def command_end(self, args: List[str]) -> None:
        super().command_end(args)
        stream = self.stream
        self.state.sounds[self.name] = OnceSound(stream.packets)

class OutputGroup(Group):
    """A group containing an output file."""
    out_path: str
    stream: audio.Stream
    marks: List[Tuple[str, int]]
    mark_set: Set[str]

    def __init__(self, state: State, out_path: str) -> None:
        super().__init__(state)
        self.out_path = out_path
        self.stream = audio.Stream()
        self.marks = []
        self.mark_set = set()

    def command_clip(self, args: List[str]) -> None:
        try:
            name, = args
        except ValueError:
            raise ScriptError("Invalid clip command")
        if name in self.mark_set:
            raise ScriptError("Duplicate clip name {!r}".format(name))
        self.state.groups.append(StreamGroup(self.state, self.stream))
        self.marks.append((name, self.stream.length))
        self.mark_set.add(name)

    def command_end(self, args: List[str]) -> None:
        super().command_end(args)
        print("Encoding {}".format(self.out_path))
        out_path = os.path.join(self.state.base_path, self.out_path)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        self.stream.encode(out_path)
        obj = {
            "marks": [mark for name, mark in self.marks] + [self.stream.length],
            "names": [name for name, mark in self.marks],
        }
        with open(out_path + ".json", "w") as fp:
            json.dump(obj, fp, indent=True, sort_keys=True)

################################################################################
# Sounds
################################################################################

PACKET_LENGTHS = [2880, 1920, 960, 480]

def packetize(length: int) -> Iterator[int]:
    """Break a length into a series of packets."""
    for n in PACKET_LENGTHS:
        while length >= n:
            yield n
            length -= n

class Sound(metaclass=ABCMeta):
    """Abstract base class for sounds which can be reused to make new sounds."""
    @abstractmethod
    def emit(self, stream: audio.Stream, length: Optional[int]) -> None: pass

class OnceSound(Sound):
    def __init__(self, packets: List[audio.Packet]) -> None:
        self.packets = packets
    def emit(self, stream: audio.Stream, length: Optional[int]) -> None:
        stream.extend(self.packets)

class LoopedSound(Sound):
    def __init__(self, packets: List[audio.Packet]) -> None:
        self.packets = packets
    def emit(self, stream: audio.Stream, length: Optional[int]) -> None:
        if not self.packets:
            print("NO")
            return
        if length is None:
            stream.extend(self.packets)
            return
        remaining = length
        while True:
            for packet in self.packets:
                if packet.size > remaining * 2:
                    return
                stream.append(packet)
                remaining -= packet.size
        print("REM", remaining)

class StretchSound(Sound):
    def __init__(self, groups: List[List[audio.Packet]]) -> None:
        self.groups = [group for group in groups if group]
    def emit(self, stream: audio.Stream, length: Optional[int]) -> None:
        if not self.groups:
            return
        if length is None:
            for group in self.groups:
                stream.extend(group)
            return
        ngroups = len(self.groups)
        gpacket: List[List[audio.Packet]] = [[] for _ in range(ngroups)]
        glength: List[int] = [0 for _ in range(ngroups)]
        remaining = length
        while True:
            minlength = min(glength)
            idx = -1
            for idx, glen in enumerate(glength):
                if glen == minlength:
                    break
            assert 0 <= idx < ngroups
            group = self.groups[idx]
            packets = gpacket[idx]
            packet = group[len(packets) % len(group)]
            if packet.size > remaining * 2:
                break
            packets.append(packet)
            remaining -= packet.size
            glength[idx] += packet.size
        for group in gpacket:
            stream.extend(group)

class StretchPitchSound(Sound):
    def __init__(self, groups: List[List[audio.Packet]]) -> None:
        self.groups = [group for group in groups if group]
        self.lengths = [sum(packet.size for packet in group)
                        for group in groups]
    def emit(self, stream: audio.Stream, length: Optional[int]) -> None:
        if not self.groups:
            return
        if length is None:
            for group in self.groups:
                stream.extend(group)
            return
        ngroups = len(self.groups)
        glength = [0 for _ in range(ngroups)]
        gcount = [0 for _ in range(ngroups)]
        remaining = length
        while True:
            minlength = min(glength)
            idx = -1
            for idx, glen in enumerate(glength):
                if glen == minlength:
                    break
            assert 0 <= idx < ngroups
            length = self.lengths[idx]
            if length > remaining * 2:
                break
            glength[idx] += length
            gcount[idx] += 1
            remaining -= length
        for count, group in zip(gcount, self.groups):
            for i in range(count):
                stream.extend(group)

################################################################################
# Main
################################################################################

def main() -> None:
    import sys

    if len(sys.argv) != 2:
        print("Error: Need script", file=sys.stderr)
        raise SystemExit(2)

    script = os.path.abspath(sys.argv[1])
    state = State(os.path.dirname(script))
    try:
        with open(script) as fp:
            state.run(fp)
    except ScriptError as ex:
        print("Error: {}:{}: {}".format(script, ex.lineno, ex),
              file=sys.stderr)
        raise SystemExit(1)

if __name__ == "__main__":
    main()
