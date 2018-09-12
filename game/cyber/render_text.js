// Module render_text contains the text rendering code.
import { gl } from '/game/cyber/global';
import { uiMatrix } from '/game/cyber/camera';
import { spriteCompositeProgram } from '/game/cyber/shaders';
import { quad } from '/game/cyber/render_util';
import { currentText } from '/game/cyber/graphics';

const vertexBuffer = gl.createBuffer();

export function renderText() {
  if (!currentText) {
    return;
  }

  const n = currentText.length;

  const arr = new Float32Array(6 * 5 * n);
  const iarr = new Uint32Array(arr.buffer);
  let i = 0;
  let j = 6 * 4 * n;
  for (let { size, y, color = -1 } of currentText) {
    size += 0.05;
    for (const [xx, yy, u] of quad) {
      arr.set([
        xx,
        arr[i + 1] = 1 - y * 2 + size * yy,
        u,
        arr[i + 3] = y - 0.5 * size * yy,
      ], i);
      i += 4;
    }
    iarr.fill(color, j, j + 6);
    j += 6;
  }

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
  gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 0, 6 * 4 * 4 * n);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.useProgram(p.program);
  gl.uniformMatrix4fv(p.uniforms.ModelViewProjection, false, uiMatrix);
  gl.uniform1i(p.uniforms.Texture, 2);
  gl.drawArrays(gl.TRIANGLES, 0, 6 * n);
  gl.uniform1i(p.uniforms.Texture, 0);

  gl.disable(gl.BLEND);
}
