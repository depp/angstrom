import { gl } from '/game/cyber/global';

export let emojiTexture;

export function initEmoji() {
  const emoji = ('\u{1f608} \u{1f62d} \u{1f631} \u{1f911} '
                 + '\u{1f92a} \u{1f92c} \u{1f92e} \u{1f92f}')
    .split(' ');
  const ecanvas = document.createElement('canvas');
  ecanvas.width = 256;
  ecanvas.height = 256;
  const ctx = ecanvas.getContext('2d');
  ctx.font = '48px "Noto Color Emoji"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let idx = 0;
  for (const e of emoji) {
    ctx.fillText(e, (idx & 3) * 64 + 32, (idx >> 2) * 64 + 32);
    idx++;
  }

  ecanvas.toBlob((b) => {
    const img = new Image();
    img.addEventListener('load', () => {
      emojiTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, emojiTexture);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(
        gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.generateMipmap(gl.TEXTURE_2D);
    });
    img.src = URL.createObjectURL(b);
  });
}
