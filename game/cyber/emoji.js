import { gl } from '/game/cyber/global';
import { randInt } from '/game/cyber/util';

export const emojiTexture = gl.createTexture();

export const hands = [];
export const people = [];

// EMOJI:
//  0.. 7: evil faces
//  8..12: hands
// 13..17: shirts
// 18..20: shoes
// 21..21: hats
// 22..24: purses
// 25..44: heads
// 45..45: shot

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
    let female = !randInt(2);
    const skinIdx = randInt(5);
    const skin = String.fromCodePoint(0x1F3FB + skinIdx);
    const j = randInt(person.length);
    if (j < 4) {
      female = false;
    }
    if (j > 6) {
      female = true;
    }
    emoji.push(person[j] + skin);
    people.push({
      hand: 8 + skinIdx,
      shirt: 13 + female * 2 + randInt(3),
      shoe: 18 + female + randInt(2),
      head: emoji.length - 1,
      hat: Math.random() < 0.8 ? -1 : 21,
      item: Math.random() < 0.5
        ? -1
        : 22 + randInt(3),
    });
  }

  const ecanvas = document.createElement('canvas');
  ecanvas.width = 512;
  ecanvas.height = 512;
  const ctx = ecanvas.getContext('2d');
  ctx.font = '48px "Noto Color Emoji"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  let idx = 0;
  function nextSprite() {
    ctx.restore();
    ctx.save();
    ctx.translate((idx & 7) * 64 + 32, (idx >> 3) * 64 + 32);
    idx++;
  }

  for (const e of emoji) {
    nextSprite();
    ctx.fillText(e, 0, 0);
  }

  nextSprite();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  g.addColorStop(0, 'white');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.arc(0, 0, 28, 0, 2 * Math.PI);
  ctx.fill();

  const { data } = ctx.getImageData(0, 0, 512, 512);
  console.log('data', data.length);
  gl.bindTexture(gl.TEXTURE_2D, emojiTexture);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(
    gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.generateMipmap(gl.TEXTURE_2D);
}

initEmoji();
