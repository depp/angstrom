# Angstrom

Experiments in small packages.

**BEWARE** this repository is just a mish-mash of random personal work. It is disastrosly unsorted and uncategorized, and everything is completely nonstandard and experimental.

Just look at the number of different programming languages that are being used here. This is some kind of project made by a crazy mountain man.

## Welcome to Cyberspace

A... bit of a JS13K game for 2018. But August and Sepetember turned out to be really bad months for project work, because I moved.

There is a nifty development server buried in here.

## Opuscraft

Opuscraft creates Opus audio files that can be further compressed using general purpose compression algorithms like Deflate. This is done by making some of the packets in the Opus stream exact copies of other packets, byte for byte. These copies take up nearly no space in the final compressed file, allowing you to achieve bitrates far lower than Opus normally allows. Even though Opus normally uses at least 6 kbit/s, Opuscraft can produce files as low as 1.5 kbit/s that are still intelligible, although they will sound messy.

The simplest way to do this is to compress a file using Opus and then decimate it, replacing every N consecitive packets with copies of a single packet in that group. This will usually give intelligible results for N=2 or N=3. At N=4, it is more common for entire phonemes to be missing from speech.

For better results, you can manually slice up an audio file into segments which are then compressed as Opus packets and arranged into an Opus file according to a script. Packet sizes can be adjusted (but only crudely) and audio can be pitch shifted to fit an even number of periods into an Opus packet.

This program operates on a script, reads WAV files, and then ouputs the result as on Opus file.
