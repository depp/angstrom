// Module render_sprite contains the sprite rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import { spriteProgram } from '/game/cyber/shaders';
import { playerPos } from '/game/cyber/player';
import {
  vecZero, vecZ, vec2Set, vec3MulAdd, vec3SetMulAdd, vec3Norm, vec3Cross,
} from '/game/cyber/vec';
import { spriteProperties } from '/game/cyber/graphics';
import { entities } from '/game/cyber/world';

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

export function renderSprite() {
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  let nSprite = 0;
  for (const entity of entities) {
    nSprite += entity.sprites.length;
  }
  if (!nSprite) {
    return;
  }
  const arr = new Float32Array(5 * 6 * nSprite);
  let i = 0;
  const spos = [];
  const right = [];
  const up = [];
  const forward = [];
  for (const entity of entities) {
    vec3MulAdd(forward, entity.pos, playerPos, -1);
    vec3Norm(forward);
    vec3Cross(right, forward, vecZ);
    vec3Norm(right);
    vec3Cross(up, right, forward);
    vec3Norm(up);
    for (const sprite of entity.sprites) {
      /* eslint prefer-const: off */
      let {
        n, size, pos = vecZero, offset = vecZero, rotate = 0, flip = false,
      } = sprite;
      const props = spriteProperties[n];
      if (props) {
        const { spriteFlip, spriteRotate = 0 } = props;
        rotate += flip ? -spriteRotate : spriteRotate;
        flip = spriteFlip ? !flip : flip;
      }
      vec3MulAdd(spos, entity.pos, pos);
      const cc = Math.cos(Math.PI / 180 * rotate);
      const ss = Math.sin(Math.PI / 180 * rotate);
      for (let j = 0; j < 6; j++) {
        let [r, s, u, v] = quad[j];
        if (flip) {
          u = 1 - u;
        }
        let r2 = r * cc - s * ss;
        let s2 = s * cc + r * ss;
        vec3SetMulAdd(arr, spos,    1,                      i + 5 * j);
        vec3SetMulAdd(arr, right,   r2 * size + offset[0],  i + 5 * j);
        vec3SetMulAdd(arr, up,      s2 * size + offset[1],  i + 5 * j);
        vec3SetMulAdd(arr, forward, -0.01 * offset[2],      i + 5 * j);
        vec2Set(arr, ((n & 7) + u) / 8, ((n >> 3) + v) / 8, i + 5 * j + 3);
      }
      i += 5 * 6;
    }
  }
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);

  const p = spriteProgram;
  if (!p) {
    return;
  }

  gl.enable(gl.DEPTH_TEST);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(p.program);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
  gl.uniformMatrix4fv(p.uniforms.M, false, cameraMatrix);

  gl.drawArrays(gl.TRIANGLES, 0, nSprite * 6);

  gl.disableVertexAttribArray(1);
  gl.disable(gl.DEPTH_TEST);
}
