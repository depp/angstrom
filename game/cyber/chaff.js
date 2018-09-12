import { frameDT, levelTime } from '/game/cyber/time';
import { PhysicsEntity } from '/game/cyber/world';
import {
  makeColor,
} from '/game/cyber/graphics';
import {
  vecZero,
  vec3Copy,
  vec3Dot,
  vec3SetMulAdd,
} from '/game/cyber/vec';
import { signedRandom } from '/game/cyber/util';

export class Bouncer extends PhysicsEntity {
  constructor(pos, radius, velocity = vecZero) {
    super(pos, radius);
    vec3Copy(this.vel, velocity);
    this.bounceCount = 0;
    this.gravity = 1;
  }

  update() {
    this.updateBody(0);
  }

  collideWorld(sepDir) {
    if (sepDir[2] > 0.7 && ++this.bounceCount > 2) {
      this.sleeping = 1;
    } else {
      vec3SetMulAdd(this.vel, sepDir, -vec3Dot(sepDir, this.vel) * 1.5);
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
