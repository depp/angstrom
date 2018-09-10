import { frameDT, levelTime } from '/game/cyber/time';
import { makeColor } from '/game/cyber/graphics';
import { vecZero, vec3SetMulAdd, vec3MulAdd } from '/game/cyber/vec';
import { spawn } from '/game/cyber/world';

class Projectile {
  constructor(origin, direction) {
    this.pos = [...origin];
    this.radius = 0.1;
    this.velocity = [];
    vec3MulAdd(this.velocity, vecZero, direction, 4);
    this.sprites = [];
    const nSprite = 15;
    const spos = new Float32Array(nSprite * 3);
    for (let i = 0; i < nSprite; i++) {
      const a = i / nSprite;
      const pos = spos.subarray(i * 3);
      vec3SetMulAdd(pos, direction, -a/2);
      this.sprites.push({
        pos,
        n: 0,
        size: 0.1 * (1 - a),
        transparent: true,
        color: makeColor(1, (1-a) ** 2, 0, 1-a),
      });
    }
    this.expiry = levelTime + 2;
    this.light = [1, 1, 0.1];
  }

  update() {
    if (levelTime > this.expiry) {
      this.dead = true;
    }
    vec3SetMulAdd(this.pos, this.velocity, frameDT);
  }

  collide(other) {
    other.damage();
  }
}

export function spawnProjectile(origin, direction) {
  spawn(new Projectile(origin, direction), 1);
}
