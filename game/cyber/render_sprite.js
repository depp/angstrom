// Module render_sprite contains the sprite rendering code.
import { canvas, gl } from '/game/cyber/global';
import {
  cameraEntity,
  cameraPos,
  cameraMatrix,
  uiMatrix,
} from '/game/cyber/camera';
import {
  spriteOpaqueProgram,
  spriteCompositeProgram,
  spriteTransparentProgram,
} from '/game/cyber/shaders';
import {
  vecZero,
  vecX,
  vecY,
  vecZ,
  vec2Set,
  vec3Copy,
  vec3MulAdd,
  vec3SetMulAdd,
  vec3Norm,
  vec3Cross,
} from '/game/cyber/vec';
import {
  modeOpaque,
  modeTransparent,
  modeUIOpaque,
  modeUITransparent,
  modeHidden,
  spriteProperties,
} from '/game/cyber/graphics';
import { entities } from '/game/cyber/world';
import { quad } from '/game/cyber/render_util';

const vertexBuffer = gl.createBuffer();

export function renderSprite() {
  const V = 6; // vertex size
  const S = 6 * 6; // sprite size
  const spriteCounts = [0, 0, 0, 0, 0]; // mode count
  const flat = [...entities];
  for (let i = 0; i < flat.length; i++) {
    const { children, sprites } = flat[i];
    if (children) {
      flat.push(...children);
    }
    for (const { mode = modeOpaque } of sprites) {
      spriteCounts[mode]++;
    }
  }
  let spriteCount = 0;
  const spriteOffsets = [];
  for (let i = 0; i < 4; i++) { // mode count
    spriteOffsets[i] = spriteCount;
    spriteCount += spriteCounts[i];
  }
  if (!spriteCount) {
    return;
  }
  const arr = new Float32Array(S * spriteCount);
  const iarr = new Uint32Array(arr.buffer);
  const tempVec = [[], [], [], []];
  const aspect = canvas.clientWidth / canvas.clientHeight;
  for (const entity of flat) {
    for (const sprite of entity.sprites) {
      let {
        n,
        size,
        pos = vecZero,
        offset = vecZero,
        rotate = 0,
        flip = false,
        mode = modeOpaque,
        color = 0xffffffff,
        anchor,
      } = sprite;
      if (mode == modeHidden) {
        continue;
      }
      if (DEBUG && size == null) {
        throw new Error('Sprite is missing size');
      }
      let i = S * spriteOffsets[mode]++;
      const props = spriteProperties[n];
      if (props) {
        const { spriteFlip, spriteRotate = 0 } = props;
        rotate += flip ? -spriteRotate : spriteRotate;
        flip = spriteFlip ? !flip : flip;
      }
      let right = vecX;
      let up = vecY;
      let forward = vecZ;
      if (mode < modeUIOpaque) {
        pos = vec3MulAdd(tempVec[0], entity.pos, pos);
        forward = vec3Norm(vec3MulAdd(tempVec[1], pos, cameraPos, -1));
        right = vec3Norm(vec3Cross(tempVec[2], forward, vecZ));
        up = vec3Norm(vec3Cross(tempVec[3], right, forward));
      } else if (anchor) {
        pos = vec3Copy(tempVec[0], pos);
        vec3SetMulAdd(pos, right, anchor[0] * aspect);
        vec3SetMulAdd(pos, up, anchor[1]);
      }
      const cc = Math.cos(Math.PI / 180 * rotate);
      const ss = Math.sin(Math.PI / 180 * rotate);
      for (let [x, y, u, v] of quad) {
        if (flip) {
          u = 1 - u;
        }
        vec3SetMulAdd(arr, pos,     1,                      i);
        vec3SetMulAdd(arr, right,   (x * cc - y * ss) * size + offset[0],  i);
        vec3SetMulAdd(arr, up,      (y * cc + x * ss) * size + offset[1],  i);
        vec3SetMulAdd(arr, forward, -0.01 * offset[2],      i);
        vec2Set(arr, ((n & 7) + u) / 8, ((n >> 3) + v) / 8, i + 3);
        iarr[i + 5] = color;
        i += V;
      }
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);

  function drawGroup(g) {
    const n = spriteCounts[g];
    if (n) {
      gl.drawArrays(
        gl.TRIANGLES,
        6 * (spriteOffsets[g] - n),
        6 * n,
      );
    }
  }

  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, V * 4, 0);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, V * 4, 12);
  gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, V * 4, 20);

  const p1 = spriteOpaqueProgram;
  const p2 = spriteTransparentProgram;
  const p3 = spriteCompositeProgram;

  gl.enable(gl.DEPTH_TEST);

  if (cameraEntity && (!DEBUG || p1)) {
    gl.useProgram(p1.program);
    gl.uniformMatrix4fv(p1.uniforms.ModelViewProjection, false, cameraMatrix);
    drawGroup(modeOpaque);
  }

  gl.enable(gl.BLEND);

  if (cameraEntity && (!DEBUG || p2)) {
    gl.useProgram(p2.program);
    gl.depthMask(false);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    gl.uniformMatrix4fv(p2.uniforms.ModelViewProjection, false, cameraMatrix);
    drawGroup(modeTransparent);
    gl.depthMask(true);
  }

  gl.disable(gl.DEPTH_TEST);

  if (!DEBUG || p3) {
    gl.useProgram(p3.program);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniformMatrix4fv(p3.uniforms.ModelViewProjection, false, uiMatrix);
    drawGroup(modeUIOpaque);
  }

  if (!DEBUG || p2) {
    gl.useProgram(p2.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    gl.uniformMatrix4fv(p2.uniforms.ModelViewProjection, false, uiMatrix);
    drawGroup(modeUITransparent);
    gl.disable(gl.BLEND);
  }

  gl.disable(gl.BLEND);

  gl.disableVertexAttribArray(1);
  gl.disableVertexAttribArray(2);
}
