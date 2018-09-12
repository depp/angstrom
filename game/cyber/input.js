// Input handling for the game. This does not handle input outside of actual
// gameplay, such as if the player is in the menu.

import {
  canvas,
  statePauseMenu,
  setState,
} from '/game/cyber/global';

// Compatibility note: We use UI Events here to bind keys, since they give us
// consistent values regardless of layout. This does not work in Edge.

// Map from key code OR mouse button to in-game action.
/* eslint-disable quote-props */
const buttonBindings = {
  'KeyW': 'f',
  'KeyA': 'l',
  'KeyS': 'b',
  'KeyD': 'r',

  'ArrowLeft': 'L',
  'ArrowUp': 'f',
  'ArrowDown': 'b',
  'ArrowRight': 'R',

  'ControlLeft': 's',
  'ControlRight': 's',

  'm0': 's', // Left mouse button
  // m1 Middle mouse button
  // m2 Right mouse button
};
/* eslint-enable quote-props */

export const buttonPress = {};
export const buttonState = {};

function zeroButtons(buttons) {
  for (const c of 'flbrLRsxy') {
    buttons[c] = 0;
  }
}

// Handle a button or key down event.
function buttonDown(event) {
  let binding;
  if (event.type == 'keydown') {
    if (event.code == 'Escape') {
      setState(statePauseMenu);
      event.preventDefault();
      return;
    }
    binding = buttonBindings[event.code];
  } else {
    // window.focus();
    binding = buttonBindings['m' + event.button];
  }
  if (binding) {
    buttonPress[binding] = 1;
    buttonState[binding] = 1;
    event.preventDefault();
  }
}

// Handle a button or key up event.
function buttonUp(event) {
  let binding;
  if (event.type == 'keyup') {
    binding = buttonBindings[event.code];
  } else {
    binding = buttonBindings['m' + event.button];
  }
  if (binding) {
    buttonState[binding] = 0;
    event.preventDefault();
  }
}

function mouseMove(event) {
  buttonPress['x'] += event.movementX || 0;
  buttonPress['y'] -= event.movementY || 0;
}

function pointerLockChange() {
  if (document.pointerLockElement == canvas) {
    document.addEventListener('mousemove', mouseMove);
    document.addEventListener('mousedown', buttonDown);
    document.addEventListener('mouseup', buttonUp);
  } else {
    document.removeEventListener('mousemove', mouseMove);
    document.removeEventListener('mousedown', buttonDown);
    document.removeEventListener('mouseup', buttonUp);
  }
}

// Handle a click on the canvas during gameplay.
export function inputClick() {
  canvas.requestPointerLock();
}

// Start listening to player input for game.
export function startInput() {
  canvas.addEventListener('click', inputClick);
  window.addEventListener('keydown', buttonDown);
  window.addEventListener('keyup', buttonUp);
  zeroButtons(buttonPress);
  zeroButtons(buttonState);
}

// Handle the end of the frame.
export function endFrameInput() {
  zeroButtons(buttonPress);
}

// Stop listening to player input for game.
export function stopInput() {
  canvas.removeEventListener('click', inputClick);
  window.removeEventListener('keydown', buttonDown);
  window.removeEventListener('keyup', buttonUp);
  document.exitPointerLock();
}

document.addEventListener('pointerlockchange', pointerLockChange);
