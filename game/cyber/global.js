// Canvas element.
export const canvas = document.getElementById('g');
// WebGL rendering context.
export const gl = canvas.getContext('webgl', { alpha: false });
gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

// Playing the game.
export const stateGame = 0;
// Main (opening) menu.
export const stateMainMenu = 1;
// Menu when the game is paused.
export const statePauseMenu = 2;
// Menu when the player is dead.
export const stateDeadMenu = 3;

// The current game state.
export let currentState = stateMainMenu;

// Set the current game state. Certain transitions are disallowed and will be
// ignored.
export function setState(newState) {
  if (newState == statePauseMenu && currentState != stateGame) {
    return;
  }
  currentState = newState;
}

// Get the canvas-relative [x, y] coordinates of the mouse event.
export function eventLocation(event) {
  let canvasX = event.pageX;
  let canvasY = event.pageY;
  for (let elt = canvas; elt; elt = elt.offsetParent) {
    canvasX += elt.scrollLeft - elt.offsetLeft;
    canvasY += elt.scrollTop - elt.offsetTop;
  }
  return [canvasX, canvasY];
}
