import { gl } from '/game/cyber/global';
import { compileShaderProgram } from '/game/cyber/shader';
import {
  initInput, clearInput, updateInput, xaxis, yaxis,
} from '/game/cyber/input';
import { initEmoji } from '/game/cyber/emoji';

// Handle to RequestAnimationFrame request.
let handle;

let prevTime = 0;

// Shader program.
let prog;
let buf;

let x = 0;
let y = 0;

// Main loop.
function main(curTime) {
  handle = 0;

  const dt = (curTime - prevTime) * 1e-3;
  x += xaxis() * dt;
  y += yaxis() * dt;
  updateInput();
  prevTime = curTime;

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

  const a = Math.sin(curTime / 300) * 0.5 + 0.5;
  gl.clearColor(a * 0.6, a * 0.5, a * 0.4, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const sprites = [
    { x: Math.cos(curTime / 3e3), y: Math.sin(curTime / 4e3), n: 0 },
    { x: Math.cos(curTime / 6e3), y: Math.sin(curTime / 5e3), n: 1 },
    { x, y, n: 2 },
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
  gl.uniform2f(prog.Offset, x, y);
  gl.drawArrays(gl.TRIANGLES, 0, sprites.length * 6);

  handle = window.requestAnimationFrame(main);
}

// Pause the game.
export function pause() {
  if (!handle) {
    return;
  }
  clearInput();
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

const vertex = `precision mediump float;
attribute vec2 Pos;
attribute vec2 TexCoord;
varying vec2 TexPos;
void main() {
  TexPos = TexCoord;
  gl_Position = vec4(Pos, 0.0, 1.0);
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
  window.addEventListener('focus', unpause);
  window.addEventListener('blur', pause);

  prog = compileShaderProgram('Pos TexCoord', '', '', vertex, fragment);
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
