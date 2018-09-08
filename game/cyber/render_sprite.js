// Module render_sprite contains the sprite rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import { spriteProgram } from '/game/cyber/shaders';
import { levelTime } from '/game/cyber/time';

const vertexBuffer = gl.createBuffer();

export function renderSprite() {
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  const sprites = [
    { x: Math.cos(levelTime / 3), y: Math.sin(levelTime / 4) + 1, n: 0 },
    { x: Math.cos(levelTime / 6), y: Math.sin(levelTime / 5) + 1, n: 1 },
    { x: Math.cos(levelTime), y: Math.sin(levelTime) + 1, n: 2 },
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
  if (!p) {
    return;
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(p.program);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.uniformMatrix4fv(p.M, false, cameraMatrix);

  gl.drawArrays(gl.TRIANGLES, 0, sprites.length * 6);

  gl.disableVertexAttribArray(1);
  gl.disable(gl.BLEND);
}
