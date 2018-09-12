import { levelTime } from '/game/cyber/time';
import {
  modeTransparent,
  makeColor,
  shotSprite,
} from '/game/cyber/graphics';
import { vec3SetMulAdd, vec3Scale } from '/game/cyber/vec';
import { PhysicsEntity } from '/game/cyber/world';

export class Projectile extends PhysicsEntity {
  constructor(origin, direction, targetMask) {
    super(origin, 0.1);
    this.targetMask = targetMask;
    vec3Scale(this.vel, direction, 4);
    const nSprite = 15;
    const spos = new Float32Array(nSprite * 3);
    for (let i = 0; i < nSprite; i++) {
      const a = i / nSprite;
      const pos = spos.subarray(i * 3);
      vec3SetMulAdd(pos, direction, -a/2);
      this.sprites.push({
        pos,
        n: shotSprite,
        size: 0.1 * (1 - a),
        mode: modeTransparent,
        color: makeColor(1, (1-a) ** 2, 0, 1-a),
      });
    }
    this.expiry = levelTime + 2;
    this.light = [1, 1, 0.1];
  }

  update() {
    if (levelTime > this.expiry) {
      this.dead = 1;
      return;
    }
    this.updateBody(this.targetMask);
  }

  collideEntity(other) {
    other.damage();
    this.dead = 1;
  }
}
