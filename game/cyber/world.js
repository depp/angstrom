// List of all entities in the world.
export const entities = [];

export function updateWorld() {
  for (const entity of entities) {
    entity.update();
  }
  let i = 0, n = entities.length;
  while (i < entities.length) {
    if (entities[i].dead) {
      n--;
      entities[i] = entities[n];
    } else {
      i++;
    }
  }
  entities.length = n;
}
