import {
  vecZero,
  vec3Distance,
} from '/game/cyber/vec';

// List of all entities in the world.
export const entities = [];

// Hit groups. Each entity is only tested for collisions against certain entity
// groups, depending on the entity's own group.
export const hitMonster = 0;
export const hitPlayer = 1;
export const hitMonsterShot = 2;
export const hitPlayerShot = 3;

export const hitGroups = [[], [], [], []];

export class Entity {
  constructor(pos, radius, ...sprites) {
    this.pos = [...(pos || vecZero)];
    this.radius = radius;
    this.sprites = sprites;
  }

  // Called for every world update, before any collisions, and at least once
  // before the entity is ever rendered.
  update() {}

  // Called when the entity collides with the world.
  collideWorld() {}

  // Called when the entity collides with another entity.
  collideEntity() {}

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

function updateList(list, parentPos) {
  for (const entity of list) {
    entity.update(parentPos);
    const {
      children, pos, radius, sleeping,
    } = entity;
    if (!sleeping && pos[2] < radius) {
      entity.collideWorld();
    }
    if (children) {
      updateList(children, pos);
    }
  }
}

function removeDead(list) {
  let i = 0, n = list.length;
  while (i < n) {
    if (list[i].dead) {
      n--;
      list[i] = list[n];
    } else {
      const { children } = list[i];
      if (children) {
        removeDead(children);
      }
      i++;
    }
  }
  list.length = n;
}

export function testCollisionList(entity, list) {
  const { pos, radius } = entity;
  for (const other of list) {
    if (other.dead) {
      continue;
    }
    const { pos: pos2, radius: radius2, children } = other;
    if (vec3Distance(pos, pos2) < radius + radius2) {
      if (children) {
        testCollisionList(entity, children);
      } else {
        entity.collideEntity(other);
      }
      if (entity.dead) {
        return;
      }
    }
  }
}

export function testCollisions(group1, group2) {
  const g1 = hitGroups[group1];
  const g2 = hitGroups[group2];
  for (const e1 of g1) {
    testCollisionList(e1, g2);
  }
}

export function updateWorld() {
  updateList(entities);
  testCollisions(hitPlayerShot, hitMonster);
  testCollisions(hitMonsterShot, hitPlayer);
  removeDead(entities);
  for (const group of hitGroups) {
    removeDead(group);
  }
}
