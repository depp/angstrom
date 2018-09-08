import { gl } from '/game/cyber/global';
import { loadedShaderSource } from '/game/cyber/shader';
import {
  initInput, clearInput, updateInput,
} from '/game/cyber/input';
import { initEmoji } from '/game/cyber/emoji';
import { updateCamera } from '/game/cyber/camera';
import { startPlayer, updatePlayer } from '/game/cyber/player';
import {
  frameDT, startTime, updateTime,
} from '/game/cyber/time';
import { render } from '/game/cyber/render';

// Handle to RequestAnimationFrame request.
let handle;

// Main loop.
function main(curTimeMS) {
  handle = 0;

  updateTime(curTimeMS);
  if (frameDT) {
    updatePlayer();
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
        return;
    }
  }
  console.error(`Unknown file: ${JSON.stringify(name)}`);
}

if (gl) {
  initEmoji();
  initInput();
  startPlayer();
  window.addEventListener('focus', unpause);
  window.addEventListener('blur', pause);
  unpause();
}

export { gl };
