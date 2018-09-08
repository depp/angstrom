// Module render contains all the WebGL rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import { spriteProgram } from '/game/cyber/shaders';
import { levelTime } from '/game/cyber/time';

// Sprite vertex buffer.
const buf = gl.createBuffer();

export function render() {
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
}
