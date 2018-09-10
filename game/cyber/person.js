import { frameDT } from '/game/cyber/time';
import {
  personSprites,
  shirtSprites,
  shoeSprites,
  topHatSprite,
  purseSprites,
} from '/game/cyber/graphics';
import {
  randInt,
  signedRandom,
  chooseRandom,
} from '/game/cyber/util';
import { Entity } from '/game/cyber/world';

export class Person extends Entity {
  constructor(i) {
    super();
    const female = randInt();
    const { head, hand } = chooseRandom(personSprites[female]);
    const shoe = chooseRandom(shoeSprites[female]);
    this.phase = 0;
    this.stride = 2**(signedRandom() * 0.2);
    this.offsets = new Float32Array(8 * 3);
    this.pos = [
      i - 10, // 4 * signedRandom(),
      0, // 4 * signedRandom(),
      0.5,
    ];
    this.sprites = [{
      n: head,
      size: 0.2,
    }, {
      n: chooseRandom(shirtSprites[female]),
      size: 0.25,
    }, {
      n: hand,
      size: 0.1,
      rotate: 180,
    }, {
      n: hand,
      size: 0.1,
      flip: true,
      rotate: 180,
    }, {
      n: shoe,
      size: 0.15,
    }, {
      n: shoe,
      size: 0.15,
      flip: true,
    }, {
      n: Math.random() < 0.2 ? topHatSprite : null,
      size: 0.15,
    }, {
      n: Math.random() < 0.3 ? chooseRandom(purseSprites[female]) : null,
      size: 0.15,
    }];
    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].offset = this.offsets.subarray(i * 3, i * 3 + 3);
    }
    this.sprites = this.sprites.filter(s => s.n != null);
  }

  update() {
    this.phase = (this.phase + frameDT * 4 * this.stride) % (2 * Math.PI);
    const s = Math.sin(this.phase);
    this.offsets.set([
      0, 0.2 + Math.abs(s) * 0.05, 2,
      0, -0.1 + Math.abs(s) * 0.03, 1,
      0.15, -0.2 - s * 0.04, 5,
      -0.15, -0.2 + s * 0.04, 5,
      0.15, -0.3 + Math.max(0, s) * 0.06, 0,
      -0.15, -0.3 + Math.max(0, -s) * 0.06, 0,
      0, 0.4 + Math.abs(s) * 0.05, 3,
      0.15, -0.25 - s * 0.04, 4,
    ]);
  }
}

for (let i = 0; i < 0; i++) {
  new Person(i).spawn();
}
