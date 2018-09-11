import {
  hitMonster,
  hitMonsterShot,
  Entity,
} from '/game/cyber/world';
import { frameDT, levelTime } from '/game/cyber/time';
import { chooseRandom, signedRandom } from '/game/cyber/util';
import {
  brainSprite,
  evilSmileySprites,
} from '/game/cyber/graphics';
import {
  vecZero,
  vec3Set,
  vec3MulAdd,
  vec3Norm,
} from '/game/cyber/vec';
import {
  playerPos,
} from '/game/cyber/player';
import { spawnProjectile } from '/game/cyber/projectile';
import { Chaff } from '/game/cyber/chaff';

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

const swarmLight = [1, 0.6, 1.0];
const tempVec = [];

class Swarm extends Entity {
  constructor(count) {
    super([0, 2, 1], 0.9);
    this.count = count;
    this.light = [];
    this.children = [new EvilBrain(this)];
    for (let i = 0; i < count; i++) {
      this.children.push(new EvilFace(0.5 + 0.2 * i / count));
    }
    this.shotTime = 0;
  }

  update() {
    vec3MulAdd(this.light, vecZero, swarmLight,
      this.children.length / this.count);
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
      return;
    }
    if (this.shotTime < levelTime) {
      vec3Norm(vec3MulAdd(tempVec, playerPos, this.pos, -1));
      spawnProjectile(this.pos, tempVec, hitMonsterShot);
      this.shotTime += 1;
    }
  }
}

new Swarm(20).spawn(hitMonster);
