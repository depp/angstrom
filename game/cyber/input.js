import { canvas } from '/game/cyber/global';

// Map from keycode OR mouse button to in-game action.
const buttonBindings = {
  87: 'f', // W
  65: 'l', // A
  83: 'b', // S
  68: 'r', // D

  37: 'L', // Left arrow
  38: 'f', // Up arrow
  39: 'R', // Right arrow
  40: 'b', // Down arrow

  17: 's', // Control

  m0: 's', // Left mouse button
  // m1 Middle mouse button
  // m2 Right mouse button
};

let buttonPress = {};
let buttonState = {};

function buttonDown(event) {
  let binding;
  if (event.type === 'keydown') {
    binding = buttonBindings[event.keyCode];
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
    binding = buttonBindings[event.keyCode];
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
}

export function clearInput() {
  buttonPress = {};
  buttonState = {};
}

export function updateInput() {
  buttonPress = {};
}

export function xaxis() {
  return (buttonState.r || 0) - (buttonState.l || 0);
}

export function yaxis() {
  return (buttonState.f || 0) - (buttonState.b || 0);
}
