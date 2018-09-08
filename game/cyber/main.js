import { gl } from '/game/cyber/global';
import { loadedShaderSource } from '/game/cyber/shader';
import { spriteProgram } from '/game/cyber/shaders';
import {
  initInput, clearInput, updateInput,
} from '/game/cyber/input';
import { initEmoji } from '/game/cyber/emoji';
import { updateCamera, cameraMatrix } from '/game/cyber/camera';
import { startPlayer, updatePlayer } from '/game/cyber/player';
import {
  frameDT, levelTime, startTime, updateTime,
} from '/game/cyber/time';

// Handle to RequestAnimationFrame request.
let handle;

// Sprite vertex buffer.
let buf;

// Main loop.
function main(curTimeMS) {
  handle = 0;

  updateTime(curTimeMS);
  if (frameDT) {
    updatePlayer();
    updateInput();
  }
  updateCamera();

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

  const a = Math.sin(levelTime * 3) * 0.5 + 0.5;
  gl.clearColor(a * 0.6, a * 0.5, a * 0.4, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const sprites = [
    { x: Math.cos(levelTime / 3), y: Math.sin(levelTime / 4), n: 0 },
    { x: Math.cos(levelTime / 6), y: Math.sin(levelTime / 5), n: 1 },
    { x: Math.cos(levelTime), y: Math.sin(levelTime), n: 2 },
  ];
  const arr = new Float32Array(4 * 6 * sprites.length);
  let i = 0;
  for (const sprite of sprites) {
    // FIXME: Deoptimize for better gzip size?
    const { x, y, n } = sprite;
    const a = 1/4, u = (n & 3)*a, v = (n >> 2)*a;
    arr.set([
      x-0.1, y-0.1, u, v+a,
      x+0.1, y-0.1, u+a, v+a,
      x-0.1, y+0.1, u, v,
      x-0.1, y+0.1, u, v,
      x+0.1, y-0.1, u+a, v+a,
      x+0.1, y+0.1, u+a, v,
    ], i);
    i += 4 * 6;
  }
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);

  const p = spriteProgram;
  if (p) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(p.program);
    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.uniformMatrix4fv(p.M, false, cameraMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, sprites.length * 6);
  }

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

  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -0.5, -0.5,
    0.5, -0.5,
    0, 0.5,
  ]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  unpause();
}

export { gl };
