let audioCtx;

// Start the audio system, if it is not already started. This must be called
// from an event handler in order to get audio permissions across most browsers
// (especially Safari, but Chrome 70 will also need this).
export function startAudio() {
  if (audioCtx) {
    return;
  }
  audioCtx = new AudioContext();

  const t0 = audioCtx.currentTime;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.01, t0);
  g.connect(audioCtx.destination);
  const osc = audioCtx.createOscillator();
  osc.connect(g);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}
