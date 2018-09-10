let audioCtx;

export function startAudio() {
  if (audioCtx) {
    return;
  }
  audioCtx = new AudioContext();

  const osc = audioCtx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
  osc.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 1);
}
