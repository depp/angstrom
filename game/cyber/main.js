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
  startInput, endFrameInput, stopInput, inputClick,
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
import {
  startAudio,
  /* START.DEBUG_ONLY */
  loadedSFXSource,
  playSFX as playSFXImpl,
  /* END.DEBUG_ONLY */
} from '/game/cyber/audio';

/* START.DEBUG_ONLY */
import { loadedShaderSource } from '/game/cyber/shader';
/* END.DEBUG_ONLY */

// Game state as of the last call to main.
let lastState;

function continueGame() {
  startAudio();
  setState(stateGame);
  inputClick();
}

function newGame() {
  resetTime();
  resetWorld();
  resetPlayer();
  new Swarm(20).spawn();
  new Person(0).spawn();
  continueGame();
}

function endGame() {
  resetWorld();
  setState(stateMainMenu);
}

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
        startInput();
        startTime();
        break;
      case stateMainMenu:
        startMenu({
          text: 'Welcome to Cyberspace',
          y: 0.1,
          size: 0.07,
        }, {
          text: 'New Game',
          y: 0.5,
          action: newGame,
        }, {
          text: 'Continue',
          action: continueGame,
        });
        break;
      case statePauseMenu:
        startMenu({
          text: 'Paused',
          y: 0.25,
          size: 0.07,
        }, {
          text: 'Continue',
          y: 0.5,
          action: continueGame,
        }, {
          text: 'End Game',
          action: endGame,
        });
        break;
      case stateDeadMenu:
        startMenu({
          text: 'You died.',
          y: 0.25,
          size: 0.07,
        }, {
          text: 'Continue',
          y: 0.5,
          action: continueGame,
        }, {
          text: 'End Game',
          action: endGame,
        });
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

function playSFX(sfxID) {
  startAudio();
  playSFXImpl(sfxID);
}

export {
  gl,
  sfxNames,
  startAudio,
  playSFX,
};

/* END.DEBUG_ONLY */
