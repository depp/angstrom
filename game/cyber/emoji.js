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

  const gender = ['\u200D\u2642\uFE0F', '\u200D\u2640\uFE0F'];
  const person = Array.from(
    // Men
    '\u{1F466}\u{1F468}\u{1F474}\u{1F9D4}'
    // Androgynous
      + '\u{1F9D1}\u{1F9D2}\u{1F9D3}'
    // Women
      + '\u{1F467}\u{1F469}\u{1F475}',
  );
  const combineItems = Array.from(
    '\u{1F33E}\u{1F373}\u{1F3A4}\u{1F3A8}\u{1F3ED}'
      + '\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}',
  );
  const professions = Array.from(
    '\u{1F46E}\u{1F477}\u{1F482}\u{1F575}\u{1F9D9}',
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
  ));
  for (let i = 0; i < 20; i++) {
    const r = Math.random();
    let female = Math.random() < 0.5;
    const skinIdx = (Math.random() * 5) | 0;
    const skin = String.fromCodePoint(0x1F3FB + skinIdx);
    if (r < 0.3) {
      const j = (Math.random() * person.length) | 0;
      if (j < 4) {
        female = false;
      }
      if (j > 6) {
        female = true;
      }
      emoji.push(person[j] + skin);
    } else if (r < 0.7) {
      emoji.push(
        String.fromCodePoint(0x1F468 + female)
          + skin
          + '\u200D'
          + combineItems[(Math.random() * combineItems.length) | 0],
      );
    } else {
      emoji.push(
        professions[(Math.random() * professions.length) | 0]
          + skin
          + gender[female | 0],
      );
    }
    people.push({
      hand: 8 + skinIdx,
      shirt: 13 + female * 2 + ((Math.random() * 3) | 0),
      shoe: 18 + female + ((Math.random() * 2) | 0),
      head: emoji.length - 1,
    });
  }
  console.log(emoji);

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
