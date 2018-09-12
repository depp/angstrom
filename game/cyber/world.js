import {
  vecZero,
  vecZ,
  vec2Distance,
  vec3Scale,
  vec3Sub,
  vec3Norm,
  vec3Distance,
  vec3SetMulAdd,
} from '/game/cyber/vec';
import { frameDT } from '/game/cyber/time';

// World gravity, in units per second squared.
const worldGravity = -10;

const maxVelocity = 8;

// List of all entities in the world.
export const entities = [];

// Hit groups. Each entity is only tested for collisions against certain entity
// groups, depending on the entity's own group.
export const hitPlayer = 0;
export const hitMonster = 1;
export const hitGroupCount = 2;

export const hitGroups = [[], []];

export class Entity {
  constructor(pos, radius, ...sprites) {
    this.pos = [...(pos || vecZero)];
    this.radius = radius;
    this.sprites = sprites;
  }

  // Called for every world update, before collision detection.
  move() {}

  // Called for every world update. Called at least once before rendering.
  update() {}

  // Called whe when the entity is damaged.
  damage() {}

  // Spawn the entity in the world.
  spawn(hitGroup) {
    entities.push(this);
    if (hitGroup != null) {
      hitGroups[hitGroup].push(this);
    }
  }
}

const sepDir = [];
function collideList(entity, list) {
  const { pos, radius } = entity;
  for (const other of list) {
    if (!other.dead && other != entity) {
      const { children, pos: pos2, radius: radius2 } = other;
      if (Math.abs(pos[0] - pos2[0]) < radius + radius2
          && Math.abs(pos[1] - pos2[1]) < radius + radius2
          && Math.abs(pos[2] - pos2[2]) < radius + radius2) {
        const d = vec2Distance(pos, pos2);
        if (d < radius + radius2) {
          if (children) {
            if (collideList(entity, children)) {
              return 1;
            }
          } else {
            vec3Sub(sepDir, pos2, pos2);
            const d3 = vec3Distance(sepDir);
            vec3Norm(sepDir);
            const sepDist = (d - radius - radius2) * d3 / d;
            entity.collideEntity(other, sepDir, sepDist);
            if (entity.dead) {
              return 1;
            }
          }
        }
      }
    }
  }
  return 0;
}

// A physics entity is an entity is affected by forces and collisions.
export class PhysicsEntity extends Entity {
  constructor(pos, radius, ...sprites) {
    super(pos, radius, ...sprites);
    this.vel = [...vecZero];
    this.sleeping = 0;
    this.gravity = 0;
  }

  updateBody(collisionMask = 0) {
    if (this.sleeping) {
      return;
    }
    const v = vec3Distance(this.vel);
    if (v > maxVelocity) {
      console.log('VEL', v);
      vec3Scale(this.vel, this.vel, maxVelocity / v);
    }
    vec3SetMulAdd(this.pos, this.vel, frameDT);
    vec3SetMulAdd(this.pos, vecZ,
      this.gravity * worldGravity * frameDT * frameDT / 2);
    vec3SetMulAdd(this.vel, vecZ, this.gravity * worldGravity * frameDT);
    for (let i = 0; i < hitGroupCount; i++) {
      if (collisionMask & (1 << i)) {
        if (collideList(this, hitGroups[i])) {
          return;
        }
      }
    }
    if (this.pos[2] < this.radius) {
      this.collideWorld(vecZ, this.radius - this.pos[2]);
    }
  }

  pushBody(dir, amt) {
    vec3SetMulAdd(this.pos, dir, amt);
    vec3SetMulAdd(this.vel, dir, 2 * amt / frameDT);
  }

  // Called when the entity collides with the world.
  collideWorld() {}

  // Called when the entity collides with another entity.
  collideEntity() {}
}

function updateList(list, parentPos) {
  // This will iterate over new items added during the loop.
  for (const entity of list) {
    entity.update(parentPos);
    if (!entity.dead) {
      const { children } = entity;
      if (children) {
        updateList(children, entity.pos);
      }
    }
  }
}

function removeDead(list, recurse) {
  let i = 0, n = list.length;
  while (i < n) {
    if (list[i].dead) {
      n--;
      list[i] = list[n];
    } else {
      if (recurse) {
        const { children } = list[i];
        if (children) {
          removeDead(children);
        }
      }
      i++;
    }
  }
  list.length = n;
}

// Reset the world, removing all entities.
export function resetWorld() {
  entities.length = 0;
  for (const group of hitGroups) {
    group.length = 0;
  }
}

// Advante the world simulation.
export function updateWorld() {
  updateList(entities, vecZero);
  removeDead(entities, true);
  for (const group of hitGroups) {
    removeDead(group);
  }
}
