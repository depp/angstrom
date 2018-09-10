import { gl } from '/game/cyber/global';
import { randInt } from '/game/cyber/util';
import { vec3Distance } from '/game/cyber/vec';

const tilesX = 8;
const tilesY = 8;
const tileSize = 64;

export const spriteTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, spriteTexture);
gl.texImage2D(
  gl.TEXTURE_2D, 0, gl.RGBA, tilesX * tileSize, tilesY * tileSize, 0,
  gl.RGBA, gl.UNSIGNED_BYTE, null,
);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(
  gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR,
);
gl.generateMipmap(gl.TEXTURE_2D);

export const hands = [];
export const people = [];

const offscreenCanvas = document.createElement('canvas');
const ctx = offscreenCanvas.getContext('2d');
offscreenCanvas.width = tileSize;
offscreenCanvas.height = tileSize;

// Render a single emoji character and return the image data as a typed array.
function renderEmoji(str) {
  ctx.clearRect(0, 0, tileSize, tileSize);
  ctx.save();
  ctx.font = '48px "Noto Color Emoji"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, tileSize / 2, tileSize / 2);
  ctx.restore();
}

// Get the image data for the sprite currently in the offscreen canvas.
function getSpriteData() {
  return ctx.getImageData(0, 0, tileSize, tileSize).data;
}

// Load a single sprite into the sprite texture.
function loadSprite(idx, data) {
  gl.texSubImage2D(
    gl.TEXTURE_2D, 0,
    (idx & 7) * tileSize, (idx >> 3) * tileSize, tileSize, tileSize,
    gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer),
  );
}

// Get the average color of an image.
function imageColor(data) {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i + 0] * data[i + 3];
    g += data[i + 1] * data[i + 3];
    b += data[i + 2] * data[i + 3];
    a += data[i + 3];
  }
  if (!a) {
    return [0, 0, 0];
  }
  return [r/a, g/a, b/a];
}

// EMOJI:
//  0.. 7: evil faces
//  8..12: hands
// 13..17: shirts
// 18..20: shoes
// 21..21: hats
// 22..24: purses
// 25..44: heads
// 45..45: shot

export let isAppleEmoji;
export let isGoogleEmoji;

export function initEmoji() {
  // Some emoji have very different colors in different fonts, we can take the
  // average color to detect the font.
  //
  // Code
  // Point   Name        Apple       Google      Distance
  // ----------------------------------------------------
  // U+2604  Comet       239,145,87  177,214,244 182
  // U+1F3AB Ticket      197,189,100 220,56,114  136
  //
  // Other candidates: U+1F386 U+1F387 U+1F39F
  const testEmoji = '\u{1F3AB}';
  renderEmoji(testEmoji);
  const testColor = imageColor(getSpriteData());
  isAppleEmoji = vec3Distance(testColor, [197, 189, 100]) < 80;
  isGoogleEmoji = vec3Distance(testColor, [220, 56, 114]) < 80;
  if (DEBUG) {
    const codePoint = testEmoji.codePointAt(0).toString(16).padStart(4, '0');
    const color = testColor.map(x => Math.round(x).toString()).join(',');
    console.log(`Color for U+${codePoint}: ${color}`);
    console.log(`Is Apple Emoji: ${isAppleEmoji}`);
    console.log(`Is Google Emoji: ${isGoogleEmoji}`);
  }

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

  let idx = 0;
  for (const e of emoji) {
    renderEmoji(e);
    loadSprite(idx, getSpriteData());
    idx++;
  }

  ctx.clearRect(0, 0, tileSize, tileSize);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  g.addColorStop(0, 'white');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.arc(0, 0, 28, 0, 2 * Math.PI);
  ctx.fill();
  loadSprite(idx, getSpriteData());
  idx++;

  gl.bindTexture(gl.TEXTURE_2D, spriteTexture);
  gl.generateMipmap(gl.TEXTURE_2D);
}

initEmoji();
