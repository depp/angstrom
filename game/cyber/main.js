// Canvas element.
export const canvas = document.getElementById('g');
// WebGL rendering context.
export const gl = canvas.getContext('webgl', { alpha: false });

// Handle to RequestAnimationFrame request.
let handle;

// Main loop.
function main(curTime) {
  handle = 0;
  const a = Math.sin(curTime / 1000);
  gl.clearColor(a * 0.6, a * 0.5, a * 0.4, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  handle = window.requestAnimationFrame(main);
}

// Pause the game.
export function pause() {
  if (!handle) {
    return;
  }
  window.cancelAnimationFrame(main);
  handle = 0;
}

// Unpause the game.
export function unpause() {
  if (handle) {
    return;
  }
  handle = window.requestAnimationFrame(main);
}

if (gl) {
  unpause();
}
