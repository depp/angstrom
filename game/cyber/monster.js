import { Entity } from '/game/cyber/world';
import { frameDT, levelTime } from '/game/cyber/time';
import { chooseRandom, signedRandom } from '/game/cyber/util';
import {
  brainSprite,
  evilSmileySprites,
  makeColor,
} from '/game/cyber/graphics';
import {
  vecZero,
  vecZ,
  vec3Set,
  vec3MulAdd,
  vec3SetMulAdd,
} from '/game/cyber/vec';

class Chaff extends Entity {
  constructor(src, velocity = vecZero) {
    const [s] = src.sprites;
    super(src.pos, src.radius, s);
    this.expiry = levelTime + 5;
    this.vel = [...velocity];
    this.bounce = 0;
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
      vec3SetMulAdd(this.pos, this.vel, frameDT);
      vec3SetMulAdd(this.vel, vecZ, -10 * frameDT);
    }
  }

  collideWorld() {
    this.bounce++;
    if (this.bounce > 2) {
      this.sleeping = 1;
      this.pos[2] = this.radius;
    } else {
      this.pos[2] = 0.4 - this.pos[2];
      this.vel[2] *= -1;
      this.rspeed *= -0.5;
      vec3MulAdd(this.vel, vecZero, this.vel, 0.5);
    }
  }
}

class EvilBrain extends Entity {
  constructor(swarm) {
    super(0, 0.3, {
      n: brainSprite,
      size: 0.3,
    });
    this.swarm = swarm;
  }

  update(pos) {
    vec3Set(this.pos, ...pos);
  }

  damage() {
    this.dead = true;
    new Chaff(this).spawn();
    this.swarm.dieTime = levelTime + 0.5;
  }
}

class EvilFace extends Entity {
  constructor(dist) {
    super(0, 0.2, {
      n: chooseRandom(evilSmileySprites),
      size: 0.2,
    });
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
  }

  update(pos) {
    this.phase = (this.phase + frameDT * 2) % (2 * Math.PI);
    vec3MulAdd(this.pos, pos, this.u, Math.cos(this.phase) * this.dist);
    vec3MulAdd(this.pos, this.pos, this.v, Math.sin(this.phase) * this.dist);
  }

  damage() {
    this.dead = true;
    const vel = [];
    vec3MulAdd(
      vel, vecZero, this.u, -Math.sin(this.phase) * this.dist * 2,
    );
    vec3MulAdd(
      vel, vel, this.v, Math.cos(this.phase) * this.dist * 2,
    );
    new Chaff(this, vel).spawn();
  }
}

class Swarm extends Entity {
  constructor(n) {
    super([0, 2, 1], 0.9);
    this.light = [1, 0.6, 1.0];
    this.children = [new EvilBrain(this)];
    for (let i = 0; i < n; i++) {
      this.children.push(new EvilFace(0.5 + 0.2 * i / n));
    }
  }

  update() {
    if (this.dieTime) {
      while (levelTime > this.dieTime) {
        if (!this.children.length) {
          this.dead = true;
          break;
        }
        const child = this.children.pop();
        child.damage();
        this.dieTime += 0.05;
      }
    }
  }
}

new Swarm(20).spawn(0);
