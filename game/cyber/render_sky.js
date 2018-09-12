// Module render_text contains the text rendering code.
import { gl } from '/game/cyber/global';
import { skyProgram } from '/game/cyber/shaders';
import { inverseCameraMatrix } from '/game/cyber/camera';
import {
  lightColor,
  lightPosition,
} from '/game/cyber/light';

const vertexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
gl.bufferData(
  gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]),
  gl.STATIC_DRAW,
);

export function renderSky() {
  const p = skyProgram;
  if (DEBUG && !p) {
    return;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);

  gl.useProgram(p.program);
  gl.uniformMatrix4fv(
    p.uniforms.InverseCameraMatrix, false, inverseCameraMatrix,
  );
  gl.uniform4fv(p.uniforms.LightPos, lightPosition.subarray(6 * 4));
  gl.uniform4fv(p.uniforms.LightColor, lightColor.subarray(6 * 4));
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(true);
}
