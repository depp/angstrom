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

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(prog.program);
  gl.enableVertexAttribArray(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(prog.Offset, x, y);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

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
uniform vec2 Offset;
varying vec2 TexPos;
void main() {
  TexPos = Pos;
  gl_Position = vec4(Pos + Offset, 0.0, 1.0);
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


  prog = compileShaderProgram('Pos', 'Offset', '', vertex, fragment);
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
