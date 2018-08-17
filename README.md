# Angstrom

Experiments in small packages.

## Opuscraft

Opuscraft creates Opus audio files that can be further compressed using general purpose compression algorithms like Deflate. This is done by making some of the packets in the Opus stream exact copies of other packets, byte for byte. These copies take up nearly no space in the final compressed file, allowing you to achieve bitrates far lower than Opus normally allows. Even though Opus normally uses at least 6 kbit/s, Opuscraft can produce files as low as 1.5 kbit/s that are still intelligible, although they will sound messy.

The simplest way to do this is to compress a file using Opus and then decimate it, replacing every N consecitive packets with copies of a single packet in that group. This will usually give intelligible results for N=2 or N=3. At N=4, it is more common for entire phonemes to be missing from speech.

For better results, you can manually slice up an audio file into segments which are then compressed as Opus packets and arranged into an Opus file according to a script. Packet sizes can be adjusted (but only crudely) and audio can be pitch shifted to fit an even number of periods into an Opus packet.

The program runs with a web browser interface in Flask. To run it, run:

    export AUDIO_FILE=<input.wav>
    export FLASK_APP=opuscraft.web
    export FLASK_DEBUG=1
    flask run

Once running, you can browse to http://localhost:5000/spectrogram to see a spectrogram of the audio file.

This requires a ton of stuff to be installed:

* Python 3
    * Flask
    * NumPy
    * SciPy
    * Pillow
* SoX (sound processing program)
* LibOpus (with develompent headers)
* LibOgg (with development headers)
