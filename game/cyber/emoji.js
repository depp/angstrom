import { gl } from '/game/cyber/global';

export let emojiTexture;

export const hands = [];
export const people = [];

export function initEmoji() {
  const emoji = [
    // Bad faces.
    ...('\u{1F608}\u{1F62D}\u{1F631}\u{1F911}'
        + '\u{1F92A}\u{1F92C}\u{1F92E}\u{1F92F}'),
  ];

  const person = Array.from(
    // Men
    '\u{1F466}\u{1F468}\u{1F474}\u{1F9D4}'
    // Androgynous
      + '\u{1F9D1}\u{1F9D2}\u{1F9D3}'
    // Women
      + '\u{1F467}\u{1F469}\u{1F475}',
  );

  for (let i = 0; i < 5; i++) {
    emoji.push(String.fromCodePoint(0x1F91A, 0x1F3FB + i));
  }
  emoji.push(...(
    // Shirts...
    // Men
    '\u{1F455}\u{1F454}'
    // Androgynous
      + '\u{1F9E5}'
    // Women
      + '\u{1F457}\u{1F45A}'
    // Shoes...
    // Men
      + '\u{1F45E}'
    // Androgynous
      + '\u{1F45F}'
    // Women
      + '\u{1F462}'
    // Hats
      + '\u{1F3A9}'
    // Purses, etc.
      + '\u{1F45B}\u{1F45C}\u{1F45D}'
  ));
  for (let i = 0; i < 20; i++) {
    let female = Math.random() < 0.5;
    const skinIdx = (Math.random() * 5) | 0;
    const skin = String.fromCodePoint(0x1F3FB + skinIdx);
    const j = (Math.random() * person.length) | 0;
    if (j < 4) {
      female = false;
    }
    if (j > 6) {
      female = true;
    }
    emoji.push(person[j] + skin);
    people.push({
      hand: 8 + skinIdx,
      shirt: 13 + female * 2 + ((Math.random() * 3) | 0),
      shoe: 18 + female + ((Math.random() * 2) | 0),
      head: emoji.length - 1,
      hat: Math.random() < 0.8 ? -1 : 21,
      item: Math.random() < 0.5
        ? -1
        : 22 + ((Math.random() * 3) | 0),
    });
  }

  const ecanvas = document.createElement('canvas');
  ecanvas.width = 512;
  ecanvas.height = 512;
  const ctx = ecanvas.getContext('2d');
  ctx.font = '48px "Noto Color Emoji"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let idx = 0;
  for (const e of emoji) {
    ctx.fillText(e, (idx & 7) * 64 + 32, (idx >> 3) * 64 + 32);
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

initEmoji();
