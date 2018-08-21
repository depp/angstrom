import json
import pathlib
import re

from . import audio

from typing import Dict

NON_URL_CHAR = re.compile("[^-_.a-zA-Z0-9]+")
def to_url(p: str) -> str:
    r = NON_URL_CHAR.sub("-", p).strip("-")
    if not r:
        raise ValueError("invalid name: {!r}".format(p))
    return r

class InputClip:
    """An input audio clip.

    Attributes:
      ident: Machine-readable clip identifier.
      name: Human-readable name.
      info_path: Path to the JSON metadata file.
      audio_path: Path to the audio clip.
    """
    ident: str
    name: str
    info_path: pathlib.Path
    audio_path: pathlib.Path

    def __init__(self,
                 ident: str,
                 name: str,
                 info_path: pathlib.Path,
                 audio_path: pathlib.Path) -> None:
        self.ident = ident
        self.name = name
        self.info_path = info_path
        self.audio_path = audio_path

class Project:
    """A project for creating audio files.

    Attributes:
      path: Path to the project directory.
      inputs: Map from input names to InputClip.
    """
    path: pathlib.Path
    inputs: Dict[str, InputClip]

    def __init__(self,
                 path: pathlib.Path) -> None:
        self.path = path
        self.inputs = {}

    def load(self) -> None:
        inputdir = pathlib.Path(self.path, "input")
        infos = set(inputdir.glob("*.json"))
        wavs = inputdir.glob("*.wav")
        inputs: Dict[str, InputClip] = {}
        for wav in wavs:
            info = wav.with_suffix(".json")
            infos.discard(info)
            ident = to_url(wav.stem)
            if ident in inputs:
                raise ValueError("duplicate input name {!r}".format(ident))
            inputs[ident] = InputClip(ident, wav.stem, info, wav)
        for info in infos:
            print("Missing WAV for {!r}".format(info.name))
        gone = set(self.inputs).difference(inputs)
        for name in gone:
            del self.inputs[name]
        for name, clip in inputs.items():
            oclip = self.inputs.get(name)
            if (oclip is None or
                oclip.info_path != clip.info_path or
                oclip.audio_path != oclip.audio_path):
                self.inputs[name] = clip
