import {
  gl,
  stateGame,
  stateMainMenu,
  statePauseMenu,
  stateDeadMenu,
  currentState,
  setState,
} from '/game/cyber/global';
import '/game/cyber/graphics';
import {
  startInput, endFrameInput, stopInput,
} from '/game/cyber/input';
import {
  startMenu, stopMenu,
} from '/game/cyber/menu';
import { updateCamera } from '/game/cyber/camera';
import { resetPlayer } from '/game/cyber/player';
import {
  frameDT, resetTime, startTime, updateTime,
} from '/game/cyber/time';
import { render } from '/game/cyber/render';
import { resetWorld, updateWorld } from '/game/cyber/world';
import { Person } from '/game/cyber/person';
import { Swarm } from '/game/cyber/monster';
import { sfxNames } from '/game/cyber/sfx';

/* START.DEBUG_ONLY */
import { loadedShaderSource } from '/game/cyber/shader';
import {
  loadedSFXSource, startAudio, playSFX,
} from '/game/cyber/audio';
/* END.DEBUG_ONLY */

// Game state as of the last call to main.
let lastState;

// Main loop.
function main(curTimeMS) {
  if (currentState != lastState) {
    if (lastState == stateGame) {
      stopInput();
    } else {
      stopMenu();
    }
    switch (currentState) {
      case stateGame:
        if (lastState != statePauseMenu) {
          resetTime();
          resetWorld();
          resetPlayer();
          new Swarm(20).spawn();
          new Person(0).spawn();
        }
        startInput();
        startTime();
        break;
      case stateMainMenu:
        startMenu('Main menu');
        break;
      case statePauseMenu:
        startMenu('Paused');
        break;
      case stateDeadMenu:
        startMenu('Dead');
        break;
    }
    lastState = currentState;
  }

  if (currentState == stateGame) {
    updateTime(curTimeMS);
    if (frameDT) {
      updateWorld();
      endFrameInput();
    }
  }
  updateCamera();

  render();

  // We put this at the bottom, this way we don't continue after an exception.
  window.requestAnimationFrame(main);
}

// Pause the game.
export function pause() {
  setState(statePauseMenu, stateGame);
}

if (gl) {
  window.requestAnimationFrame(main);
  window.addEventListener('blur', pause);
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

function playSFXInteractive(sfxID) {
  startAudio();
  playSFX(sfxID);
}

export {
  gl,
  sfxNames,
  startAudio,
  playSFXInteractive,
};

/* END.DEBUG_ONLY */
