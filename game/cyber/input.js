import { canvas } from '/game/cyber/global';

// Map from keycode OR mouse button to in-game action.
const buttonBindings = {
  KeyW: 'f',
  KeyA: 'l',
  KeyS: 'b',
  KeyD: 'r',

  ArrowLeft: 'L',
  ArrowUp: 'f',
  ArrowDown: 'b',
  ArrowRight: 'R',

  ControlLeft: 's',
  ControlRight: 's',
  /*
    For .keyCode values:
  87: 'f', // W
  65: 'l', // A
  83: 'b', // S
  68: 'r', // D

  37: 'L', // Left arrow
  38: 'f', // Up arrow
  39: 'R', // Right arrow
  40: 'b', // Down arrow

  17: 's', // Control
  */

  m0: 's', // Left mouse button
  // m1 Middle mouse button
  // m2 Right mouse button
};

const buttonPress = {};
const buttonState = {};

function zeroButtons(buttons) {
  for (const c of 'flbrLRs') {
    buttons[c] = 0;
  }
}

function buttonDown(event) {
  let binding;
  if (event.type === 'keydown') {
    binding = buttonBindings[event.code];
  } else {
    window.focus();
    binding = buttonBindings['m' + event.button];
  }
  if (binding) {
    buttonPress[binding] = 1;
    buttonState[binding] = 1;
    event.preventDefault();
  }
}

function buttonUp(event) {
  let binding;
  if (event.type === 'keyup') {
    binding = buttonBindings[event.code];
  } else {
    binding = buttonBindings['m' + event.button];
  }
  if (binding) {
    buttonState[binding] = 0;
    event.preventDefault();
  }
}

export function initInput() {
  canvas.addEventListener('click', () => {
    console.log('CLICK');
  });
  window.addEventListener('keydown', buttonDown);
  window.addEventListener('keyup', buttonUp);
  clearInput();
}

export function clearInput() {
  zeroButtons(buttonPress);
  zeroButtons(buttonState);
}

export function updateInput() {
  zeroButtons(buttonPress);
}

export function xaxis() {
  return buttonState.r - buttonState.l;
}

export function yaxis() {
  return buttonState.f - buttonState.b;
}
