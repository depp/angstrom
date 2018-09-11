import {
  cmap,
  oscillatorTypes,

  opGain,
  opOscillator,
  opOutput,
  opEnvFrequency,
  opEnvGain,

  sfxData,
  sfxNames,
} from '/game/cyber/sfx';

/* START.DEBUG_ONLY */
import { ParseError, parseScript } from '/tools/lib/parse_sfx';
/* END.DEBUG_ONLY */

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

const sfxPrograms = sfxData.split(' ').map(
  prog => prog.split(',').map(op => Array.from(op).map(c => cmap.indexOf(c))),
);

// Convert time from parameter value to seconds.
//
// Range: 0, 5-2000ms.
function convertTime(n) {
  return n && 0.005 * (1.1 ** n);
}

// Convert gain from parameter value to scalar value.
//
// Range: -infinity, -60..0 dB.
function convertGain(n) {
  return n && (0.9 ** (63 - n));
}

// Convert auido frequency from parameter value to scalar value.
//
// Range: 40-16000 Hz.
function convertFreq(n) {
  return 40 * (1.1 ** n);
}

function envelope(param, values, convert) {
  param.value = convert(values[2]);
  let curTime = audioCtx.currentTime;
  for (let i = 3; i < values.length; i += 2) {
    param.linearRampToValueAtTime(
      convert(values[i+1]),
      curTime += convertTime(values[i]),
    );
  }
  return curTime;
}

export function playSFX(sfxID) {
  const prog = sfxPrograms[sfxID];
  if (!prog || !audioCtx) {
    return;
  }
  const playable = [];
  const items = [audioCtx.destination];
  let node;
  let endTime = audioCtx.currentTime;
  let itemEndTime;
  for (const operation of prog) {
    itemEndTime = endTime;
    switch (operation[0]) {
      case opGain:
        node = audioCtx.createGain();
        items.push(node, node.gain);
        break;
      case opOscillator:
        node = audioCtx.createOscillator();
        node.type = oscillatorTypes[operation[1]];
        items.push(node, node.frequency);
        playable.push(node);
        break;
      case opOutput:
        node.connect(items[operation[1]]);
        break;
      case opEnvFrequency:
        itemEndTime = envelope(items[operation[1]], operation, convertFreq);
        break;
      case opEnvGain:
        itemEndTime = envelope(items[operation[1]], operation, convertGain);
        break;
    }
    endTime = Math.max(endTime, itemEndTime);
  }
  for (node of playable) {
    node.start();
    node.stop(endTime);
  }
}

// =============================================================================
// Debug build support
// =============================================================================

/* START.DEBUG_ONLY */

export function loadedSFXSource(name, data) {
  if (!name.endsWith('.txt')) {
    console.warn(`Unknown SFX type ${JSON.stringify(name)}`);
    return;
  }
  if (data == null) {
    return;
  }
  const idx = sfxNames.indexOf(name.substring(0, name.length - 4));
  if (idx === -1) {
    console.warn(`Unknown SFX ${JSON.stringify(name)}`);
    return;
  }
  let prog;
  try {
    prog = parseScript(data);
  } catch (e) {
    if (e instanceof ParseError) {
      console.error(`${name}:${e.line}: ${e.message}`);
      return;
    }
    throw e;
  }
  sfxPrograms[idx] = prog;
  console.log(`Reloaded SFX ${name}`);
}

/* END.DEBUG_ONLY */
