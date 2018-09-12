import { entities } from '/game/cyber/world';
import { cameraPos } from '/game/cyber/camera';
import { vec3Distance } from '/game/cyber/vec';

export const lightColor = new Float32Array(4 * 8);
export const lightPosition = new Float32Array(4 * 8);

const lightSources = [];

const daytimeLights = [
  new Float32Array([
    1, 1, 0.8, 0,
    0.1, 0.3, 0.5, 0,
  ]),
  new Float32Array([
    0.5, -0.4, 1, 0,
    -0.5, 1, 1, 0,
  ]),
];

export function updateLight() {
  const ambient = daytimeLights;
  const n = ambient[0].length / 4;
  const rem = 8 - n;
  lightSources.length = 0;
  for (const entity of entities) {
    if (entity.light) {
      lightSources.push({
        entity,
        lightPriority: 1 / vec3Distance(cameraPos, entity.pos)
          * vec3Distance(entity.light),
      });
    }
  }
  lightSources.sort((a, b) => a.lightPriority - b.lightPriority);
  lightPosition.fill(1);
  lightColor.fill(0);
  for (let i = 0; i < Math.min(rem, lightSources.length); i++) {
    const { entity } = lightSources[i];
    lightPosition.set(entity.pos, i * 4);
    lightColor.set(entity.light, i * 4);
  }
  lightColor.set(ambient[0], (8 - n) * 4);
  lightPosition.set(ambient[1], (8 - n) * 4);
}
