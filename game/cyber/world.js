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
export const hitGroupCount = 2;

export const hitGroups = [[], []];

// The size of the world grid.
let worldSizeX;
let worldSizeY;
// Array of heights for each grid cell.
let worldHeight;

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

/*
// Get the time at which collision occurs on a given axis. The previous and
// current position, ignoring collision, is pos0 and pos1. The position where
// the collision occurs is coll.
function collisionTime(pos0, pos1, coll) {
  if (pos0 == coll) {
    return 0;
  }
  if ((coll - pos0) * (pos1 - pos0) <= 0) {
    return -1;
  }
  return (coll - pos0) / (pos1 - pos0);
}
*/

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
          - this.radius + (this.doesStep ? stepHeight : 0.1);
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
    const zFeet = zPos1 - this.radius;
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
        this.pos[2] = zFloor + this.radius;
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
        this.pos[2] = zFloor + this.radius;
        this.collideWorld(vecZ);
      }
    }
    /*
    if (getTileHeight(xTile, yTile) > zReach) {
      // We already intersect a wall, move back. Just move back in the stupid
      // way: look at three adjacent tiles to the one we've clipped into.
      const xAvail = getTileHeight(xTile - xDir, yTile) < zReach;
      const yAvail = getTileHeight(xTile, yTile - yDir) < zReach;
      console.log(`Dir: ${xDir},${yDir} Tile: ${xTile},${yTile}\n`
                  + `xAvail: ${xAvail} yAvail: ${yAvail}\n`
                  + `xDist: ${xOut - xPos0} yDist: ${yOut - yPos0}`);
      if (xAvail && (!yAvail
                     || Math.abs(xOut - xPos0) < Math.abs(yOut - yPos0))) {
        this.pos[0] = xOut;
        console.log(`Move x ${-xDir}`);
      } else if (yAvail) {
        this.pos[1] = yOut;
        console.log(`Move y ${-yDir}`);
      } else {
        this.pos[0] = xOut;
        this.pos[1] = yOut;
        console.log(`Move x ${-xDir} y ${-yDir}`);
      }
    }
    */
    /*
    while (true) {
      getTile(xTile, yTile) > zReach;
    }
    // Scan all tiles in the direction of movement, compute the place where we
    // would collide with those tiles (if there would be a collision).
    const xr = this.radius * Math.sign(xPos1 - xPos0);
    const yr = this.radius * Math.sign(yPos1 - yPos0);
    const xt0 = (xPos0 - xr) | 0;
    const yt0 = (yPos0 - yr) | 0;
    const xt1 = (xPos1 + xr) | 0;
    const yt1 = (yPos1 + yr) | 0;

    const xt1 = (xPos1 + this.radius * Math.sign(xPos1 - xPos0)) | 0;
    const yt1 = (yPos1 + this.radius * Math.sign(yPos1 - yPos0)) | 0;
    // Whethe we hit tiles in the X and Y directions.
    let xHit = getTileHeight(xt1, yt0) > zReach;
    let yHit = getTileHeight(xt0, yt1) > zReach;
    // Position where collision happens.
    const xColl = xt1 + (xPos1 < xPos0 ? 1 + this.radius : -this.radius);
    const yColl = yt1 + (yPos1 < yPos0 ? 1 + this.radius : -this.radius);
    if (xt0 != xt1) {
      if (yt0 != yt1) {
        if (!(xHit || yHit) && getTileHeight(xt1, yt1) > zReach) {
          yHit = collisionTime(xPos0, xPos1, xColl)
            < collisionTime(yPos0, yPos1, yColl);
          xHit = !yHit;
        }
      } else {
        // yHit = false;
      }
    } else {
      // xHit = false;
      // yHit = yHit && yt0 != yt1;
    }
    if (DEBUG && RELEASE) {
      const xVel = (xPos1 - xPos0) / frameDT;
      const yVel = (yPos1 - yPos0) / frameDT;
      const badX = xHit && !((xPos0 <= xColl && xColl <= xPos1)
                             || (xPos0 >= xColl && xColl >= xPos1));
      const badY = yHit && !((yPos0 <= yColl && yColl <= yPos1)
                             || (yPos0 >= yColl && yColl >= yPos1));
      if (badX || badY) {
        const xHit0 = getTileHeight(xt1, yt0) > 1;
        const yHit0 = getTileHeight(xt0, yt1) > 1;
        console.warn(
          'Bad collision\n'
            + `    Velocity=(${xVel}, ${yVel})\n`
            + '\n'
            + `    XHit=(${xHit0}, ${xHit}) XBad=${badX}\n`
            + `    XPos=(${xPos0}, ${xColl}, ${xPos1})\n`
            + `    XTile=(${xt0}, ${xt1})\n`
            + '\n'
            + `    YHit=(${yHit0}, ${yHit}) YBad=${badY}\n`
            + `    YPos=(${yPos0}, ${yColl}, ${yPos1})\n`
            + `    YTile=(${yt0}, ${yt1})`,
        );
      }
    }
    if (xHit) {
      this.collideWorld(
        [Math.sign(xColl - xPos1), 0, 0],
        Math.abs(xColl - xPos1),
      );
    }
    if (yHit) {
      this.collideWorld(
        [0, Math.sign(yColl - yPos1), 0],
        Math.abs(yColl - yPos1),
      );
    }
    if (this.doesStep && false) {
      const [xPos, yPos, zPos] = this.pos;
      const zFeet = zPos - this.radius;
      let zAccum = 0;
      let zWeight = 0;
      const x0 = (xPos - this.radius * 0.5) | 0;
      const x1 = (xPos + this.radius * 0.5) | 0;
      const y0 = (yPos - this.radius * 0.5) | 0;
      const y1 = (yPos + this.radius * 0.5) | 0;
      let zFloor = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const z = getTileHeight(x, y);
          if (Math.abs(z - zFeet) < stepHeight) {
            const w = (0.5 - Math.abs(x - xPos - 0.5)) * 2 / this.radius;
            zAccum += z;
            zWeight += w * z;
          }
          zFloor = Math.max(zFloor, z);
        }
      }
      const doLock = zWeight > 0
            && this.vel[0] < 1
            && (this.floorLocked || Math.abs(zAccum / zWeight - zFeet) < 0.1);
      this.floorLocked = doLock;
      if (DEBUG && doLock != this.floorLocked) {
        console.log(`Floor lock: ${this.floorLocked}`);
      }
      if (doLock) {
        const zTarget = zAccum / zWeight;
        const zAccel = 10 * frameDT;
        this.pos[2] = Math.abs(zTarget - zFeet) < zAccel
          ? zTarget + this.radius
          : this.pos[2] + Math.sign(zTarget - zFeet) * zAccel;
      }
      if (zWeight > 0 && this.vel) {
        this.floorLocked = true;
        console.log('FLOOR LOCKED');
      } else {
        this.floorLocked = false;
        console.log('FLOOR unlocked');
      }
    }
    if (!this.floorLocked || true) {
      const z = getTileHeight(xPos0 | 0, yPos0 | 0);
      if (this.pos[2] < z + this.radius) {
        this.collideWorld(vecZ, z + this.radius - this.pos[2]);
      }
    }
    */
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
