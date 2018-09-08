// Module render_sprite contains the sprite rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import { spriteProgram } from '/game/cyber/shaders';
import { levelTime } from '/game/cyber/time';
import { playerPos } from '/game/cyber/player';
import {
  vec2Set, vec3MulAdd, vec3SetMulAdd, vec3Norm, vec3Cross,
} from '/game/cyber/vec';
import { emojiTexture } from '/game/cyber/emoji';

const vertexBuffer = gl.createBuffer();

// A unit quad as two triangles. XY and UV coordinates.
const quad = [
  [-1, -1, 0, 1],
  [ 1, -1, 1, 1],
  [-1,  1, 0, 0],
  [-1,  1, 0, 0],
  [ 1, -1, 1, 1],
  [ 1,  1, 1, 0],
];

const vecZ = [0, 0, 1];

export function renderSprite() {
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  const sprites = [
    { pos: [Math.cos(levelTime / 3), 0, Math.sin(levelTime / 4) + 0.5], n: 0 },
    { pos: [Math.cos(levelTime / 6), 0, Math.sin(levelTime / 5) + 0.5], n: 1 },
    { pos: [Math.cos(levelTime), 0, Math.sin(levelTime) + 0.5], n: 2 },
  ];
  const arr = new Float32Array(5 * 6 * sprites.length);
  let i = 0;
  const relPos = [];
  const right = [];
  for (const sprite of sprites) {
    const { pos, n } = sprite;
    vec3MulAdd(relPos, pos, playerPos, -1);
    vec3Cross(right, relPos, vecZ);
    vec3Norm(right);
    for (let j = 0; j < 6; j++) {
      const [r, s, u, v] = quad[j];
      vec3SetMulAdd(arr, pos,   1,       i + 5 * j);
      vec3SetMulAdd(arr, right, r * 0.2, i + 5 * j);
      vec3SetMulAdd(arr, vecZ,  s * 0.2, i + 5 * j);
      vec2Set(arr, ((n & 3) + u) / 4, ((n >> 2) + v) / 4, i + 5 * j + 3);
    }
    i += 5 * 6;
  }
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);

  const p = spriteProgram;
  if (!p || !emojiTexture) {
    return;
  }

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
  gl.disable(gl.DEPTH_TEST);
}
