import { frameDT, levelTime } from '/game/cyber/time';
import { Entity } from '/game/cyber/world';
import {
  makeColor,
} from '/game/cyber/graphics';
import {
  vecZero,
  vecZ,
  vec3MulAdd,
  vec3SetMulAdd,
} from '/game/cyber/vec';
import { signedRandom } from '/game/cyber/util';

export class Bouncer extends Entity {
  constructor(pos, radius, velocity = vecZero) {
    super(pos, radius);
    this.vel = [...velocity];
    this.bounceCount = 0;
  }

  update() {
    if (!this.sleeping) {
      vec3SetMulAdd(this.pos, this.vel, frameDT);
      vec3SetMulAdd(this.vel, vecZ, -10 * frameDT);
    }
  }

  collideWorld() {
    this.bounceCount++;
    if (this.bounceCount > 2) {
      this.sleeping = 1;
      this.pos[2] = this.radius;
    } else {
      this.pos[2] = this.radius * 2 - this.pos[2];
      this.vel[2] *= -1;
      this.rspeed *= -0.5;
      vec3MulAdd(this.vel, vecZero, this.vel, 0.5);
      this.bounce();
    }
  }

  bounce() {}
}

export class Chaff extends Bouncer {
  constructor(src, velocity = vecZero) {
    super(src.pos, src.radius, velocity);
    this.sprites.push(src.sprites[0]);
    this.expiry = levelTime + 5;
    this.rspeed = signedRandom(0.5) * 1000;
  }

  update() {
    const [s] = this.sprites;
    this.dead = levelTime > this.expiry;
    const frac = (this.expiry - levelTime) / 5;
    s.color = makeColor(frac * 3, frac, frac, frac * 4 - 3);
    s.size = this.radius * Math.min(1, frac * 5);
    if (!this.sleeping) {
      s.rotate = ((s.rotate || 0) + this.rspeed * frameDT) % 360;
    }
    super.update();
  }

  bounce() {
    this.rspeed *= -0.5;
  }
}
