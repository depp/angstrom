import { gl } from '/game/cyber/global';
import { compileShaderProgram } from '/game/cyber/shader';
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

// Shader program.
let prog;
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

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(prog.program);
  gl.enableVertexAttribArray(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.uniformMatrix4fv(prog.M, false, cameraMatrix);
  gl.drawArrays(gl.TRIANGLES, 0, sprites.length * 6);

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

export function loadData(name, data) {
  console.log(`Loaded data ${JSON.stringify(name)} ${JSON.stringify(data)}`);
}

const vertex = `precision mediump float;
attribute vec2 Pos;
attribute vec2 TexCoord;
varying vec2 TexPos;
uniform mat4 M;
void main() {
  TexPos = TexCoord;
  gl_Position = M * vec4(Pos * 0.6, 0.0, 1.0).xzyw;
}
`;

const fragment = `precision mediump float;
varying vec2 TexPos;
uniform sampler2D Texture;
void main() {
  gl_FragColor = texture2D(Texture, TexPos);
}
`;

if (gl) {
  initEmoji();
  initInput();
  startPlayer();
  window.addEventListener('focus', unpause);
  window.addEventListener('blur', pause);

  prog = compileShaderProgram('Pos TexCoord', 'Scale M', '', vertex, fragment);
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
