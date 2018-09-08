// Module render_sprite contains the sprite rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import { spriteProgram } from '/game/cyber/shaders';
import { frameDT } from '/game/cyber/time';
import { playerPos } from '/game/cyber/player';
import {
  vec2Set, vec3MulAdd, vec3SetMulAdd, vec3Norm, vec3Cross,
} from '/game/cyber/vec';
import { emojiTexture } from '/game/cyber/emoji';
import { signedRandom } from '/game/cyber/util';

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

const sprites = [];
for (let i = 0; i < 40; i++) {
  sprites.push({
    n: i % 20,
    pos: [signedRandom(), signedRandom(), signedRandom()],
    vel: [signedRandom(), signedRandom(), signedRandom()],
  });
}

export function renderSprite() {
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  const arr = new Float32Array(5 * 6 * sprites.length);
  let i = 0;
  const pos = [];
  const relPos = [];
  const right = [];
  const up = [];
  for (const sprite of sprites) {
    for (let i = 0; i < 3; i++) {
      let p = sprite.pos[i], v = sprite.vel[i];
      p += v * frameDT;
      if (p < -1) {
        p = -2 - p;
        v = -v;
      } else if (p > 1) {
        p = 2 - p;
        v = -v;
      }
      sprite.pos[i] = p;
      sprite.vel[i] = v;
    }
    vec3MulAdd(pos, vecZ, sprite.pos, 0.5);
    const { n } = sprite;
    vec3MulAdd(relPos, pos, playerPos, -1);
    vec3Cross(right, relPos, vecZ);
    vec3Norm(right);
    vec3Cross(up, right, relPos);
    vec3Norm(up);
    for (let j = 0; j < 6; j++) {
      const [r, s, u, v] = quad[j];
      vec3SetMulAdd(arr, pos,   1,       i + 5 * j);
      vec3SetMulAdd(arr, right, r * 0.2, i + 5 * j);
      vec3SetMulAdd(arr, up,    s * 0.2, i + 5 * j);
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
