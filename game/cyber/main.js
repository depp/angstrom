import { gl } from '/game/cyber/global';
import '/game/cyber/graphics';
import {
  initInput, clearInput, updateInput,
} from '/game/cyber/input';
import { updateCamera } from '/game/cyber/camera';
import { startPlayer } from '/game/cyber/player';
import {
  frameDT, startTime, updateTime,
} from '/game/cyber/time';
import { render } from '/game/cyber/render';
import { updateWorld } from '/game/cyber/world';
import '/game/cyber/person';
import '/game/cyber/monster';
import { sfxNames } from '/game/cyber/sfx';

/* START.DEBUG_ONLY */
import { loadedShaderSource } from '/game/cyber/shader';
import {
  loadedSFXSource, startAudio, playSFX,
} from '/game/cyber/audio';
/* END.DEBUG_ONLY */

// Handle to RequestAnimationFrame request.
let handle;

// Main loop.
function main(curTimeMS) {
  handle = 0;

  updateTime(curTimeMS);
  if (frameDT) {
    updateWorld();
    updateInput();
  }
  updateCamera();

  render();

  handle = window.requestAnimationFrame(main);
}

// Pause the game.
export function pause() {
  if (!handle) {
    return;
  }
  clearInput();
  window.cancelAnimationFrame(handle);
  handle = 0;
}

// Unpause the game.
export function unpause() {
  if (handle) {
    return;
  }
  handle = window.requestAnimationFrame(main);
  startTime();
}

if (gl) {
  initInput();
  startPlayer();
  window.addEventListener('focus', unpause);
  window.addEventListener('blur', pause);
  unpause();
}

/* START.DEBUG_ONLY */

// Callback for when data is loaded dynamically by the development server. Not
// used in the release version.
export function loadedData(name, data) {
  const i = name.indexOf('/');
  if (i != -1) {
    const dir = name.substr(0, i);
    const base = name.substr(i + 1);
    switch (dir) {
      case 'shader':
        loadedShaderSource(base, data);
        render();
        return;
      case 'sfx':
        loadedSFXSource(base, data);
        return;
    }
  }
  console.error(`Unknown file: ${JSON.stringify(name)}`);
}

export {
  gl,
  sfxNames,
  startAudio,
  playSFX,
};

/* END.DEBUG_ONLY */
