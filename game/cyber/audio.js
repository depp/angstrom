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
  // g.gain.setValueAtTime(0.01, t0);
  makeADSR(g.gain, [t0, t0 + 0.5], [30, 30, 30, 30]);
  g.connect(audioCtx.destination);
  const osc = audioCtx.createOscillator();
  osc.connect(g);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

// Convert time from parameter value to seconds.
export function convertTime(n) {
  return n && 0.005 * (1.08 ** n);
}

// Convert gain from parameter value to scalar value.
export function convertGain(n) {
  return n && (0.7 ** (9 - n));
}

// Set the parameter to follow an ADSR envelope.
//
// param: AudioParam
// gateOn: Gate on timestamp
// gateOff: Gate off timestamp
// adsr: ADSR parameters
// offset: Offset to apply to envelope output
// scale: Scale to apply to envelope output
function makeADSR(param, [gateOn, gateOff], adsr, offset = 0, scale = 1) {
  const t = convertTime(adsr[0]);
  // Attack
  if (t > 0) {
    param.value = offset;
    param.setValueAtTime(offset, gateOn);
    param.linearRampToValueAtTime(offset + scale, gateOn + t);
  } else {
    param.value = offset + scale;
    param.setValueAtTime(offset + scale, gateOn);
  }
  // Decay
  param.setTargetAtTime(
    offset + scale * convertGain(adsr[2]),
    gateOn + t,
    convertTime(adsr[1]),
  );
  // Sustain
  param.cancelScheduledValues(gateOff);
  // Release
  param.linearRampToValueAtTime(offset, gateOff + convertTime(adsr[3]));
}
