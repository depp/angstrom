// Module render_tile contains the level tile rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import { tileProgram } from '/game/cyber/shaders';

const vertexBuffer = gl.createBuffer();

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

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.disableVertexAttribArray(1);
  gl.disable(gl.DEPTH_TEST);
}
