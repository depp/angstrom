// Module render_sprite contains the sprite rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import { spriteProgram } from '/game/cyber/shaders';
import { levelTime } from '/game/cyber/time';
import { vec2Set, vec3Set, vec3MulAdd } from '/game/cyber/vec';

const vertexBuffer = gl.createBuffer();

// A unit quad as two triangles. XY and UV coordinates.
/* eslint no-multi-spaces: off, array-bracket-spacing: off */
const quad = [
  [-1, -1, 0, 1],
  [ 1, -1, 1, 1],
  [-1,  1, 0, 0],
  [-1,  1, 0, 0],
  [ 1, -1, 1, 1],
  [ 1,  1, 1, 0],
];

export function renderSprite() {
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  const sprites = [
    { x: Math.cos(levelTime / 3), y: Math.sin(levelTime / 4) + 0.5, n: 0 },
    { x: Math.cos(levelTime / 6), y: Math.sin(levelTime / 5) + 0.5, n: 1 },
    { x: Math.cos(levelTime), y: Math.sin(levelTime) + 0.5, n: 2 },
  ];
  const arr = new Float32Array(5 * 6 * sprites.length);
  let i = 0;
  const right = [], up = [];
  for (const sprite of sprites) {
    // FIXME: Deoptimize for better gzip size?
    const { x, y, n } = sprite;
    vec3Set(right, 0.2, 0, 0);
    vec3Set(up, 0, 0, 0.2);
    for (let j = 0; j < 6; j++) {
      const [r, s, u, v] = quad[j];
      vec3Set(arr, x, 0, y, i + 5 * j);
      vec3MulAdd(arr, right, r, i + 5 * j);
      vec3MulAdd(arr, up, s, i + 5 * j);
      vec2Set(arr, ((n & 3) + u) / 4, ((n >> 2) + v) / 4, i + 5 * j + 3);
    }
    i += 5 * 6;
  }
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);

  const p = spriteProgram;
  if (!p) {
    return;
  }

  gl.enable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(p.program);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
  gl.uniformMatrix4fv(p.M, false, cameraMatrix);

  gl.drawArrays(gl.TRIANGLES, 0, sprites.length * 6);

  gl.disableVertexAttribArray(1);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
}
