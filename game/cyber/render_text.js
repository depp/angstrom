// Module render_text contains the text rendering code.
import { gl } from '/game/cyber/global';
import { uiMatrix } from '/game/cyber/camera';
import { spriteCompositeProgram } from '/game/cyber/shaders';
import { quad } from '/game/cyber/render_util';

const vertexBuffer = gl.createBuffer();

export function renderText() {
  const arr = new Float32Array(6 * 5);
  let i = 0;
  for (const vertex of quad) {
    arr.set(vertex, i);
    i += 4;
  }

  const iarr = new Uint32Array(arr.buffer);
  iarr.fill(0xffffffff, 6 * 4);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);

  const p = spriteCompositeProgram;
  if (DEBUG && !p) {
    return;
  }

  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 0, 6 * 4 * 4);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.useProgram(p.program);
  gl.uniformMatrix4fv(p.uniforms.ModelViewProjection, false, uiMatrix);
  gl.uniform1i(p.uniforms.Texture, 2);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.uniform1i(p.uniforms.Texture, 0);

  gl.disable(gl.BLEND);
}
