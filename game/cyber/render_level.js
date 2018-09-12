// Module render_level contains the level tile rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import { levelProgram } from '/game/cyber/shaders';
import { entities } from '/game/cyber/world';
import { levels } from '/game/cyber/level';

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

  gl.enable(gl.DEPTH_TEST);
  gl.useProgram(p.program);
  gl.enableVertexAttribArray(0);
  gl.uniformMatrix4fv(p.uniforms.ModelViewProjection, false, cameraMatrix);
  gl.uniform1i(p.uniforms.Texture, 1);
  gl.uniform3fv(p.uniforms.LightPos, lightPos);
  gl.uniform3fv(p.uniforms.LightColor, lightColor);

  for (const level of levels) {
    if (!level) {
      continue;
    }
    const vertexCount = level.bindMeshBuffer();
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  }

  gl.disableVertexAttribArray(0);
  gl.disable(gl.DEPTH_TEST);
}
