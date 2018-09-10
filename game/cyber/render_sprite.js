// Module render_sprite contains the sprite rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import {
  spriteSolidProgram,
  spriteTransparentProgram,
} from '/game/cyber/shaders';
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
  const V = 6; // vertex size
  const S = 6 * 6; // sprite size
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  let nSolid = 0;
  let nTransparent = 0;
  const flat = [...entities];
  for (let i = 0; i < flat.length; i++) {
    const { children, sprites } = flat[i];
    if (children) {
      flat.push(...children);
    }
    for (const { transparent } of sprites) {
      if (transparent) {
        nTransparent++;
      } else {
        nSolid++;
      }
    }
  }
  if (!(nSolid + nTransparent)) {
    return;
  }
  const arr = new Float32Array(S * (nSolid + nTransparent));
  const iarr = new Uint32Array(arr.buffer);
  const spos = [];
  const right = [];
  const up = [];
  const forward = [];
  let solidVertex = 0;
  let transparentVertex = S * nSolid;
  for (const entity of flat) {
    for (const sprite of entity.sprites) {
      /* eslint prefer-const: off */
      let {
        n, size, pos = vecZero, offset = vecZero, rotate = 0, flip = false,
        transparent, color = 0xffffffff,
      } = sprite;
      const i = (transparent
        ? (transparentVertex += S)
        : (solidVertex += S)) - S;
      const props = spriteProperties[n];
      if (props) {
        const { spriteFlip, spriteRotate = 0 } = props;
        rotate += flip ? -spriteRotate : spriteRotate;
        flip = spriteFlip ? !flip : flip;
      }
      vec3MulAdd(spos, entity.pos, pos);
      vec3MulAdd(forward, spos, playerPos, -1);
      vec3Norm(forward);
      vec3Cross(right, forward, vecZ);
      vec3Norm(right);
      vec3Cross(up, right, forward);
      vec3Norm(up);
      const cc = Math.cos(Math.PI / 180 * rotate);
      const ss = Math.sin(Math.PI / 180 * rotate);
      for (let j = 0; j < 6; j++) {
        let [x, y, u, v] = quad[j];
        if (flip) {
          u = 1 - u;
        }
        let x2 = x * cc - y * ss;
        let y2 = y * cc + x * ss;
        vec3SetMulAdd(arr, spos,    1,                      i + V * j);
        vec3SetMulAdd(arr, right,   x2 * size + offset[0],  i + V * j);
        vec3SetMulAdd(arr, up,      y2 * size + offset[1],  i + V * j);
        vec3SetMulAdd(arr, forward, -0.01 * offset[2],      i + V * j);
        vec2Set(arr, ((n & 7) + u) / 8, ((n >> 3) + v) / 8, i + V * j + 3);
        iarr[i + V * j + 5] = color;
      }
    }
  }
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);

  gl.enable(gl.DEPTH_TEST);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, V * 4, 0);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, V * 4, 12);
  gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, V * 4, 20);

  let p = spriteSolidProgram;
  if (p && nSolid) {
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(p.uniforms.ModelViewProjection, false, cameraMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, nSolid * 6);
  }

  p = spriteTransparentProgram;
  if (p && nTransparent) {
    gl.useProgram(p.program);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    gl.uniformMatrix4fv(p.uniforms.ModelViewProjection, false, cameraMatrix);
    gl.drawArrays(gl.TRIANGLES, nSolid * 6, nTransparent * 6);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  gl.disableVertexAttribArray(1);
  gl.disableVertexAttribArray(2);
  gl.disable(gl.DEPTH_TEST);
}
