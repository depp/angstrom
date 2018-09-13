import {
  vecZero,
  vecZ,
  vec2Distance,
  vec3Scale,
  vec3Dot,
  vec3Sub,
  vec3Norm,
  vec3Distance,
  vec3SetMulAdd,
} from '/game/cyber/vec';
import { frameDT } from '/game/cyber/time';

// World gravity, in units per second squared.
const worldGravity = -10;

// Maximum height of a step.
const stepHeight = 0.3;

const maxVelocity = 8;

// List of all entities in the world.
export const entities = [];

// Hit groups. Each entity is only tested for collisions against certain entity
// groups, depending on the entity's own group.
export const hitPlayer = 0;
export const hitMonster = 1;
export const hitPerson = 2;
export const hitGroupCount = 3;

export const hitGroups = [[], [], []];

// The size of the world grid.
let worldSizeX;
let worldSizeY;
// Array of heights for each grid cell.
let worldHeight;

export class Entity {
  constructor(pos, radius, ...sprites) {
    this.pos = [...(pos || vecZero)];
    this.radius = radius;
    this.zradius = radius;
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

  drop() {
    this.pos[2] = getTileHeight(this.pos[0] | 0, this.pos[1] | 0)
      + this.zradius;
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
            vec3Sub(sepDir, pos, pos2);
            vec3Norm(sepDir);
            entity.collideEntity(other, sepDir);
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
    this.doesStep = false;
    this.floorLocked = false;
  }

  updateBody(collisionMask = 0) {
    if (this.sleeping) {
      return;
    }
    const [xPos0, yPos0, zPos0] = this.pos;
    const v = vec3Distance(this.vel);
    if (v > maxVelocity) {
      vec3Scale(this.vel, this.vel, maxVelocity / v);
    }
    vec3SetMulAdd(this.pos, this.vel, frameDT);
    if (!this.floorLocked) {
      vec3SetMulAdd(this.pos, vecZ,
        this.gravity * worldGravity * frameDT * frameDT / 2);
      vec3SetMulAdd(this.vel, vecZ, this.gravity * worldGravity * frameDT);
    }
    for (let i = 0; i < hitGroupCount; i++) {
      if (collisionMask & (1 << i)) {
        if (collideList(this, hitGroups[i])) {
          return;
        }
      }
    }

    // Handle collisions with the walls.
    let [xPos1, yPos1, zPos1] = this.pos;
    const zReach = Math.max(zPos0, zPos1)
          - this.zradius + (this.doesStep ? stepHeight : 0.1);
    const xDir = xPos1 > xPos0 ? 1 : -1;
    const yDir = yPos1 > yPos0 ? 1 : -1;
    let xTile0 = (xPos1 - xDir * this.radius) | 0;
    let xTile1 = (xPos1 + xDir * this.radius) | 0;
    let yTile0 = (yPos1 - yDir * this.radius) | 0;
    let yTile1 = (yPos1 + yDir * this.radius) | 0;
    let yBlock;
    for (let i = xTile0; i != xTile1; i += xDir) {
      if (getTileHeight(i, yTile1) > zReach) {
        yBlock = 1;
      }
    }
    let xBlock;
    for (let i = yTile0; i != yTile1; i += yDir) {
      if (getTileHeight(xTile1, i) > zReach) {
        xBlock = 1;
      }
    }
    const xOut = xTile1 + (xPos0 > xPos1) - xDir * this.radius;
    const yOut = yTile1 + (yPos0 > yPos1) - yDir * this.radius;
    if (!xBlock && !yBlock && getTileHeight(xTile1, yTile1) > zReach) {
      yBlock = Math.abs((yPos1 - yPos0) * (xOut - xPos0))
        > Math.abs((xPos1 - xPos0) * (yOut - yPos0));
      xBlock = !yBlock;
      // console.log(`corner collision: ${yBlock?'y':'x'}`);
    }
    if (xBlock) {
      this.pos[0] = xPos1 = xOut;
      this.collideWorld([-xDir, 0, 0]);
    }
    if (yBlock) {
      this.pos[1] = yPos1 = yOut;
      this.collideWorld([0, -yDir, 0]);
    }

    // Handle collisions with the floor.
    const zFeet = zPos1 - this.zradius;
    if (this.doesStep) {
      let zFloor = getTileHeight(xPos1 | 0, yPos1 | 0);
      xTile0 = (xPos1 - 0.5) | 0;
      yTile0 = (yPos1 - 0.5) | 0;
      let zSum = 0;
      let zWeight = 0;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const z = getTileHeight(xTile0 + j, yTile0 + i);
          if (Math.abs(z - zFloor) < stepHeight) {
            const wx = 1 - Math.abs((xTile0 + j + 0.5) - xPos1);
            const wy = 1 - Math.abs((yTile0 + i + 0.5) - yPos1);
            if (wx > 0 && wy > 0) {
              zSum += z * wx * wy;
              zWeight += wx * wy;
            }
          }
        }
      }
      if (zWeight > 0.1) {
        zFloor = zSum / zWeight;
      }
      // const wasLocked = this.floorLocked;
      this.floorLocked = this.floorLocked
        ? this.vel[2] < 1 || zFeet - zFloor < stepHeight
        : zFeet < zFloor;
      /*
      if (DEBUG) {
        if (wasLocked != this.floorLocked) {
          console.log(`Locked: ${this.floorLocked}`);
        }
      }
      */
      if (this.floorLocked) {
        this.pos[2] = zFloor + this.zradius;
        this.vel[2] = 0;
      }
    } else {
      xTile0 = (xPos1 - this.radius * 0.9) | 0;
      xTile1 = (xPos1 + this.radius * 0.9) | 0;
      yTile0 = (yPos1 - this.radius * 0.9) | 0;
      yTile1 = (yPos1 + this.radius * 0.9) | 0;
      let zFloor = -100;
      let zMin = 100;
      for (let i = yTile0; i <= yTile1; i++) {
        for (let j = xTile1; j <= xTile1; j++) {
          const z = getTileHeight(i, j);
          if (z < zReach) {
            zFloor = Math.max(zFloor, z);
          }
          zMin = Math.min(zFloor, z);
        }
      }
      // Failsafe in case we get punched through the floor.
      zFloor = Math.max(zFloor, zMin);
      if (zFeet < zFloor) {
        this.pos[2] = zFloor + this.zradius;
        this.collideWorld(vecZ);
      }
    }
  }

  pushBody(dir, amt) {
    vec3SetMulAdd(this.pos, dir, amt);
    const v = vec3Dot(dir, this.vel);
    if (v < 0) {
      vec3SetMulAdd(this.vel, dir, -v);
    }
  }

  // Called when the entity collides with the world.
  collideWorld() {}

  // Called when the entity collides with another entity.
  collideEntity(other, sepDir) {
    const a = vec3Dot(sepDir, this.vel);
    if (a < 0) {
      vec3SetMulAdd(this.vel, sepDir, -a * 2);
    }
  }
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

export function setWorldGrid(sizeX, sizeY, heightGrid) {
  worldSizeX = sizeX;
  worldSizeY = sizeY;
  worldHeight = heightGrid;
}

function getTileHeight(x, y) {
  return x >= 0 && y >= 0 && x < worldSizeX && y < worldSizeY
    ? worldHeight[y * worldSizeX + x]
    : 0;
}
