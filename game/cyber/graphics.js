import { gl } from '/game/cyber/global';
import { randInt, chooseRandom, clamp } from '/game/cyber/util';
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

const offscreenCanvas = document.createElement('canvas');
const ctx = offscreenCanvas.getContext('2d');
offscreenCanvas.width = tileSize;
offscreenCanvas.height = tileSize;

// Get the image data for the sprite currently in the offscreen canvas.
function getSpriteData() {
  return ctx.getImageData(0, 0, tileSize, tileSize).data;
}

// Render a single emoji character and return the image data.
function renderEmoji(str) {
  ctx.clearRect(0, 0, tileSize, tileSize);
  ctx.save();
  ctx.font = '48px "Noto Color Emoji"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, tileSize / 2, tileSize / 2);
  const m = ctx.measureText(str);
  ctx.restore();
  if (m.width > 80) {
    // This indicates something has gone wrong with the emoji.
    return {};
  }
  const data = getSpriteData();
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
  if (!(r + g + b)) {
    return {};
  }
  return {
    data,
    color: [r/a, g/a, b/a],
  };
}

// Load a single sprite into the sprite texture.
function loadSprite(idx, data) {
  gl.texSubImage2D(
    gl.TEXTURE_2D, 0,
    (idx & 7) * tileSize, (idx >> 3) * tileSize, tileSize, tileSize,
    gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer),
  );
}

// Sprite modes.
export const modeOpaque = 0;
export const modeTransparent = 1;

export let isAppleEmoji;
export let isGoogleEmoji;
export const spriteProperties = [];

// Predefined sprite indexes.
export const shotSprite = 0;
export const crosshairSprite = 1;

// Current sprite index (must start after predefined sprites).
let curSprite = 2;

// Emoji sprites.
export let brainSprite;
export const evilSmileySprites = [];
export const personSprites = [[], []];
export const shirtSprites = [[], []];
export const shoeSprites = [[], []];
export let topHatSprite;
export const purseSprites = [[], []];

const charProperties = {};

function setCharProperties(...propList) {
  for (const prop of propList) {
    for (const chr of prop.chars) {
      charProperties[chr] = Object.assign(charProperties[chr] || {}, prop);
    }
  }
}

// Add an emoji to the sprite texture and return its index.
function makeEmojiSprite(str) {
  const { data } = renderEmoji(str);
  if (!data) {
    return null;
  }
  loadSprite(curSprite, data);
  const [c] = str;
  spriteProperties[curSprite] = charProperties[c] || {};
  return curSprite++;
}

// Add a sequence of emoji to the sprite textures and add their indexes to the
// given lists.
function makeEmojiSpriteList(strs, ...lists) {
  for (const str of strs) {
    const idx = makeEmojiSprite(str);
    if (idx != null) {
      for (const list of lists) {
        list.push(idx);
      }
    }
  }
}

function makeGenderedEmojiSprites(list, sprites) {
  const [androgynous, male, female] = sprites.split(',');
  makeEmojiSpriteList(androgynous, list[0], list[1]);
  makeEmojiSpriteList(male, list[0]);
  makeEmojiSpriteList(female, list[1]);
}

export const noiseTexture = gl.createTexture();

export function loadGraphics() {
  ctx.clearRect(0, 0, tileSize, tileSize);
  ctx.save();
  ctx.translate(32, 32);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  g.addColorStop(0, 'white');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.arc(0, 0, 28, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
  loadSprite(shotSprite, getSpriteData());

  ctx.clearRect(0, 0, tileSize, tileSize);
  ctx.save();
  ctx.beginPath();
  ctx.translate(32, 32);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.moveTo(0, 10);
    ctx.lineTo(0, 20);
  }
  ctx.stroke();
  ctx.restore();
  loadSprite(crosshairSprite, getSpriteData());

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
  const { color } = renderEmoji(testEmoji);
  isAppleEmoji = vec3Distance(color, [197, 189, 100]) < 80;
  isGoogleEmoji = vec3Distance(color, [220, 56, 114]) < 80;
  if (DEBUG) {
    const codePoint = testEmoji.codePointAt(0).toString(16).padStart(4, '0');
    const colorText = color.map(x => Math.round(x).toString()).join(',');
    console.log(`Color for U+${codePoint}: ${colorText}`
                + ` (apple: ${isAppleEmoji}, google: ${isGoogleEmoji})`);
  }
  if (isAppleEmoji) {
    setCharProperties(
      // Rotate shoes.
      { chars: '\u{1F45E}\u{1F45F}', spriteRotate: 30 },
      // Flip hands.
      { chars: '\u{1F91A}', spriteFlip: true },
    );
  }

  // ===========================================================================
  // Monsters
  // ===========================================================================

  brainSprite = makeEmojiSprite('\u{1F9E0}');

  makeEmojiSpriteList(
    '\u{1F608}\u{1F62D}\u{1F631}\u{1F911}'
      + '\u{1F92A}\u{1F92C}\u{1F92E}\u{1F92F}',
    evilSmileySprites,
  );

  // ===========================================================================
  // People
  // ===========================================================================

  const skinTone = [];
  for (let i = 0; i < 5; i++) {
    skinTone.push(String.fromCodePoint(0x1F3FB + i));
  }

  const hands = [];
  makeEmojiSpriteList(skinTone.map(x => '\u{1F91A}' + x), hands);

  const baseHeads = [
    [...'\u{1F9D1}\u{1F9D2}\u{1F9D3}\u{1F466}\u{1F468}\u{1F474}\u{1F9D4}'],
    [...'\u{1F9D1}\u{1F9D2}\u{1F9D3}\u{1F467}\u{1F469}\u{1F475}'],
  ];
  for (let female = 0; female < 2; female++) {
    while (personSprites[female].length < 10) {
      const skin = randInt(5);
      const head = makeEmojiSprite(
        chooseRandom(baseHeads[female]) + skinTone[skin],
      );
      if (head != null) {
        personSprites[female].push({
          head,
          hand: hands[skin],
        });
      }
    }
  }

  makeGenderedEmojiSprites(
    shirtSprites,
    '\u{1F9E5},\u{1F455}\u{1F454},\u{1F457}\u{1F45A}',
  );

  makeGenderedEmojiSprites(
    shoeSprites,
    '\u{1F45F}\u{1F97E},\u{1F45E},\u{1F462}\u{1F97F}',
  );

  topHatSprite = makeEmojiSprite('\u{1F3A9}');

  makeGenderedEmojiSprites(
    purseSprites,
    ',,\u{1F45B}\u{1F45C}\u{1F45D}',
  );

  gl.bindTexture(gl.TEXTURE_2D, spriteTexture);
  gl.generateMipmap(gl.TEXTURE_2D);

  // ===========================================================================
  // Noise
  // ===========================================================================

  const noiseSize = 256;
  const noise = new Uint8Array(noiseSize * noiseSize * 4);
  for (let i = 0; i < noise.length; i++) {
    noise[i] = Math.random() * 256;
  }
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, noiseSize, noiseSize, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, noise,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
}

loadGraphics();

export function makeColor(r, g, b, a = 1) {
  return (clamp((r * 256) | 0, 0, 255)
          | (clamp((g * 256) | 0, 0, 255) << 8)
          | (clamp((b * 256) | 0, 0, 255) << 16)
          | (clamp((a * 256) | 0, 0, 255) << 24));
}
