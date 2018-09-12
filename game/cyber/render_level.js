// Module render_level contains the level tile rendering code.
import { gl } from '/game/cyber/global';
import { cameraEntity, cameraMatrix } from '/game/cyber/camera';
import {
  levelStoneProgram,
} from '/game/cyber/shaders';
import {
  levelVertexSize,
  levels,
} from '/game/cyber/level';
import {
  lightColor,
  lightPosition,
} from '/game/cyber/light';

export function renderLevel() {
  const p = levelStoneProgram;
  if (!cameraEntity || (DEBUG && !p)) {
    return;
  }

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
  gl.uniform4fv(p.uniforms.LightPos, lightPosition);
  gl.uniform4fv(p.uniforms.LightColor, lightColor);

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
