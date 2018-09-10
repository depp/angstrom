import { vec3Distance } from '/game/cyber/vec';

// List of all entities in the world.
export const entities = [];

// Hit groups. Each entity is only tested for collisions against certain entity
// groups, depending on the entity's own group.
export const hitGroups = [[], []];

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

export function testCollisions(group1, group2) {
  const g1 = hitGroups[group1];
  const g2 = hitGroups[group2];
  for (const e1 of g1) {
    const { pos, radius } = e1;
    for (const e2 of g2) {
      const { pos: pos2, radius: radius2 } = e2;
      if (vec3Distance(pos, pos2) < radius + radius2) {
        e1.collide(e2);
      }
    }
  }
}

export function updateWorld() {
  for (const entity of entities) {
    entity.update();
  }
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
