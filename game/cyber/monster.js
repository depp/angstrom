import { spawn } from '/game/cyber/world';
import { frameDT } from '/game/cyber/time';
import { chooseRandom, signedRandom } from '/game/cyber/util';
import {
  brainSprite,
  evilSmileySprites,
} from '/game/cyber/graphics';
import { vecZero, vec3MulAdd } from '/game/cyber/vec';

class Swarm {
  constructor(n) {
    this.sprites = [{
      n: brainSprite,
      size: 0.3,
    }];
    this.pos = [0, 2, 1];
    this.radius = 0.9;
    for (let i = 0; i < n; i++) {
      const theta = Math.PI * signedRandom();
      const phi = Math.asin(signedRandom());
      this.sprites.push({
        n: chooseRandom(evilSmileySprites),
        size: 0.2,
        phase: Math.PI * signedRandom(),
        u: [
          Math.cos(theta) * Math.cos(phi),
          Math.sin(theta) * Math.cos(phi),
          Math.sin(phi),
        ],
        v: [
          -Math.sin(theta),
          Math.cos(theta),
          0,
        ],
        r: 0.5 + 0.2 * i/n,
        pos: [...vecZero],
      });
    }
  }

  update() {
    for (const sprite of this.sprites) {
      /* eslint-disable prefer-const */
      let {
        phase, u, v, r, pos,
      } = sprite;
      if (u) {
        sprite.phase = phase = (phase + frameDT * 2) % (2 * Math.PI);
        vec3MulAdd(pos, vecZero, u, Math.cos(phase) * r);
        vec3MulAdd(pos, pos, v, Math.sin(phase) * r);
      }
    }
  }
}

spawn(new Swarm(20), 0);
