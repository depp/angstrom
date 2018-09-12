// Module render_level contains the level tile rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import { levelProgram } from '/game/cyber/shaders';
import { entities } from '/game/cyber/world';
import {
  levelVertexSize,
  levels,
} from '/game/cyber/level';

const lightPos = new Float32Array(3 * 4);
const lightColor = new Float32Array(3 * 4);
const lightSources = [];

export function renderLevel() {
  const p = levelProgram;
  if (DEBUG && !p) {
    return;
  }

  lightSources.length = 0;
  for (const entity of entities) {
    if (entity.light) {
      lightSources.push(entity);
    }
  }
  lightColor.fill(0);
  for (let i = 0; i < Math.min(4, lightSources.length); i++) {
    const s = lightSources[i];
    lightPos.set(s.pos, i * 3);
    lightColor.set(s.light, i * 3);
  }
  lightPos.set([0, 0, 1]);
  lightColor.set([1, 1, 1]);

  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.enableVertexAttribArray(2);
  gl.enableVertexAttribArray(3);
  gl.enableVertexAttribArray(4);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.useProgram(p.program);
  gl.uniformMatrix4fv(p.uniforms.ModelViewProjection, false, cameraMatrix);
  gl.uniform1i(p.uniforms.Texture, 1);
  gl.uniform3fv(p.uniforms.LightPos, lightPos);
  gl.uniform3fv(p.uniforms.LightColor, lightColor);

  for (const level of levels) {
    if (!level) {
      continue;
    }
    const vertexCount = level.bindMeshBuffer();
    const stride = levelVertexSize * 4;
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 12);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 28);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 40);
    gl.vertexAttribPointer(4, 3, gl.FLOAT, false, stride, 52);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  }

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  gl.disableVertexAttribArray(1);
  gl.disableVertexAttribArray(2);
  gl.disableVertexAttribArray(3);
  gl.disableVertexAttribArray(4);
}
