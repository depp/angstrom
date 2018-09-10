import { spawn } from '/game/cyber/world';
import { frameDT } from '/game/cyber/time';
import { chooseRandom, signedRandom } from '/game/cyber/util';
import {
  brainSprite,
  evilSmileySprites,
} from '/game/cyber/graphics';
import { vecZero, vec3MulAdd } from '/game/cyber/vec';

class EvilFace {
  constructor(dist) {
    const theta = Math.PI * signedRandom();
    const phi = Math.asin(signedRandom());
    this.pos = [...vecZero];
    this.radius = 0.2;
    this.u = [
      Math.cos(theta) * Math.cos(phi),
      Math.sin(theta) * Math.cos(phi),
      Math.sin(phi),
    ];
    this.v = [
      -Math.sin(theta),
      Math.cos(theta),
      0,
    ];
    this.phase = Math.PI * signedRandom();
    this.dist = dist;
    this.sprites = [{
      n: chooseRandom(evilSmileySprites),
      size: 0.2,
    }];
  }

  update(pos) {
    this.phase = (this.phase + frameDT * 2) % (2 * Math.PI);
    vec3MulAdd(this.pos, pos, this.u, Math.cos(this.phase) * this.dist);
    vec3MulAdd(this.pos, this.pos, this.v, Math.sin(this.phase) * this.dist);
  }
}

class Swarm {
  constructor(n) {
    this.sprites = [{
      n: brainSprite,
      size: 0.3,
    }];
    this.pos = [0, 2, 1];
    this.radius = 0.9;
    this.light = [1, 0.6, 1.0];
    this.children = [];
    for (let i = 0; i < n; i++) {
      this.children.push(new EvilFace(0.5 + 0.2 * i / n));
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
