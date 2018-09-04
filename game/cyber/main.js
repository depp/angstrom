import { gl } from '/game/cyber/gl';
import { compileShaderProgram } from '/game/cyber/shader';

// Handle to RequestAnimationFrame request.
let handle;

// Shader program.
let prog;
let buf;

// Main loop.
function main(curTime) {
  handle = 0;

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

  const a = Math.sin(curTime / 300) * 0.5 + 0.5;
  gl.clearColor(a * 0.6, a * 0.5, a * 0.4, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(prog.program);
  gl.enableVertexAttribArray(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

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

const vertex = `precision mediump float;
attribute vec2 Pos;
void main() {
  gl_Position = vec4(Pos, 0.0, 1.0);
}
`;

const fragment = `void main() {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`;

if (gl) {
  prog = compileShaderProgram('Pos', '', '', vertex, fragment);
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
