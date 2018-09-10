import { Entity } from '/game/cyber/world';
import { frameDT, levelTime } from '/game/cyber/time';
import { chooseRandom, signedRandom } from '/game/cyber/util';
import {
  brainSprite,
  evilSmileySprites,
} from '/game/cyber/graphics';
import {
  vecZero,
  vecZ,
  vec3MulAdd,
  vec3SetMulAdd,
} from '/game/cyber/vec';

class DeadEvilFace extends Entity {
  constructor(face) {
    super();
    this.pos = face.pos;
    this.radius = 0.2;
    this.sprites = face.sprites;
    this.expiry = levelTime + 5;
    this.vel = [];
    vec3MulAdd(
      this.vel, vecZero, face.u, -Math.sin(face.phase) * face.dist * 2,
    );
    vec3MulAdd(
      this.vel, this.vel, face.v, Math.cos(face.phase) * face.dist * 2,
    );
    this.bounce = 0;
  }

  update() {
    this.dead = levelTime > this.expiry;
    if (!this.sleeping) {
      vec3SetMulAdd(this.pos, this.vel, frameDT);
      vec3SetMulAdd(this.vel, vecZ, -10 * frameDT);
    }
  }

  collideWorld() {
    if (this.sleeping) {
      return;
    }
    this.bounce++;
    if (this.bounce > 2) {
      this.sleeping = 1;
      this.pos[2] = this.radius;
    } else {
      this.pos[2] = 0.4 - this.pos[2];
      this.vel[2] *= -1;
      vec3MulAdd(this.vel, vecZero, this.vel, 0.5);
    }
  }
}

class EvilFace extends Entity {
  constructor(dist) {
    super();
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

  damage() {
    this.dead = true;
    new DeadEvilFace(this).spawn();
  }
}

class Swarm extends Entity {
  constructor(n) {
    super();
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

new Swarm(20).spawn(0);
