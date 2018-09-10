import { frameDT } from '/game/cyber/time';
import { vecZero, vec3SetMulAdd, vec3MulAdd } from '/game/cyber/vec';
import { entities } from '/game/cyber/world';

class Projectile {
  constructor(origin, direction) {
    this.pos = [...origin];
    this.velocity = [];
    vec3MulAdd(this.velocity, vecZero, direction, 4);
    this.sprites = [{
      n: 0,
      size: 0.2,
      transparent: true,
    }];
  }

  update() {
    vec3SetMulAdd(this.pos, this.velocity, frameDT);
  }
}

export function spawnProjectile(origin, direction) {
  entities.push(new Projectile(origin, direction));
}
