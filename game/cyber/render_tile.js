// Module render_tile contains the level tile rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import { tileProgram } from '/game/cyber/shaders';
import { entities } from '/game/cyber/world';

const vertexBuffer = gl.createBuffer();
const lightPos = new Float32Array(3 * 4);
const lightColor = new Float32Array(3 * 4);
const lightSources = [];

export function renderTile() {
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  const arr = new Float32Array([
    // Top
    -4, -4, 0,
    4, -4, 0,
    -4, 4, 0,
    -4, 4, 0,
    4, -4, 0,
    4, 4, 0,
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);

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

  const p = tileProgram;
  if (!p) {
    return;
  }

  gl.enable(gl.DEPTH_TEST);
  gl.useProgram(p.program);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(p.uniforms.ModelViewProjection, false, cameraMatrix);
  gl.uniform1i(p.uniforms.Texture, 1);
  gl.uniform3fv(p.uniforms.LightPos, lightPos);
  gl.uniform3fv(p.uniforms.LightColor, lightColor);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.disableVertexAttribArray(1);
  gl.disable(gl.DEPTH_TEST);
}
