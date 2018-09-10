import { vec3Distance } from '/game/cyber/vec';

// List of all entities in the world.
export const entities = [];

// Hit groups. Each entity is only tested for collisions against certain entity
// groups, depending on the entity's own group.
export const hitGroups = [[], []];

function updateList(list, parentPos) {
  for (const entity of list) {
    entity.update(parentPos);
    const { children, pos } = entity;
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
      i++;
    }
  }
  list.length = n;
}

export function testCollisionList(entity, list) {
  const { pos, radius } = entity;
  for (const other of list) {
    const { pos: pos2, radius: radius2, children } = other;
    if (vec3Distance(pos, pos2) < radius + radius2) {
      if (children) {
        testCollisionList(entity, children);
      } else {
        entity.collide(other);
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
  testCollisions(1, 0);
  removeDead(entities);
  for (const group of hitGroups) {
    removeDead(group);
  }
}

export function spawn(entity, hitGroup) {
  entities.push(entity);
  if (hitGroup != null) {
    hitGroups[hitGroup].push(entity);
  }
}
