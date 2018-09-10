import { entities } from '/game/cyber/world';
import { frameDT } from '/game/cyber/time';
import { chooseRandom, signedRandom } from '/game/cyber/util';
import { evilSmileySprites } from '/game/cyber/graphics';

class Swarm {
  constructor(n) {
    this.sprites = [];
    this.pos = [0, 0, 1];
    for (let i = 0; i < n; i++) {
      this.sprites.push({
        n: chooseRandom(evilSmileySprites),
        size: 0.2,
        pos: [signedRandom(), signedRandom(), signedRandom()],
        vel: [signedRandom(), signedRandom(), signedRandom()],
      });
    }
  }

  update() {
    for (const sprite of this.sprites) {
      for (let i = 0; i < 3; i++) {
        let p = sprite.pos[i], v = sprite.vel[i];
        p += v * frameDT;
        if (p < -1) {
          p = -2 - p;
          v = -v;
        } else if (p > 1) {
          p = 2 - p;
          v = -v;
        }
        sprite.pos[i] = p;
        sprite.vel[i] = v;
      }
    }
  }
}

entities.push(new Swarm(20));
