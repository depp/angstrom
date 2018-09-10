// List of all entities in the world.
export const entities = [];

export function updateWorld() {
  for (const entity of entities) {
    entity.update();
  }
}
