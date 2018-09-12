import { gl } from '/game/cyber/global';
import {
  unitVecs,
  vec3Sub,
  vec3Distance,
  vec3MulAdd,
  vec3Dot,
  vec3Cross,
  vec3Norm,
  vec3Scale,
  mat3SetVec,
  mat3Inverse,
} from '/game/cyber/vec';
import {
  setWorldGrid,
} from '/game/cyber/world';

// Level names.
const levelStart = 0;

export const levelVertexSize = 16;

class Level {
  constructor(meshBuildFunc) {
    this.meshBuildFunc = meshBuildFunc;
  }

  buildMesh() {
    if (!this.heightGrid) {
      this.meshBuildFunc(this);
    }
  }

  bindMeshBuffer() {
    if (!this.meshBuffer) {
      this.buildMesh();
      this.meshBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.mesh, gl.STATIC_DRAW);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffer);
    }
    return this.vertexCount;
  }

  startLevel() {
    this.buildMesh();
    setWorldGrid(this.sizeX, this.sizeY, this.heightGrid);
  }
}

// Array of all levels.
export const levels = [];

(function makeLevels() {
  let tiles;

  const neighbors = [-1, 0, 1, 0, -1];

  function createMesh(level) {
    const sizeX = maxX + 1 - minX;
    const sizeY = maxY + 1 - minY;
    const grid = new Float32Array(sizeX * sizeY);
    let mesh = new Float32Array(256);
    let pos = 0;
    let x;
    let y;
    const vx = [];
    const vy = [];
    const vz = [];
    const mat = new Float32Array(9);
    // Emit a single mesh triangle.
    function emit(uAxis, vAxis, isEdge, ...verts) {
      if (levelVertexSize * 3 > mesh.length - pos) {
        const narr = new Float32Array(mesh.length * 2);
        narr.set(mesh);
        mesh = narr;
      }
      vec3Sub(vx, verts[1], verts[0]);
      vec3Sub(vy, verts[2], verts[0]);
      // Distance from edge to interior point (point #2).
      const edgeDist = vec3Distance(vec3MulAdd(
        vz, vy, vx, -vec3Dot(vx, vy) / vec3Dot(vx, vx),
      ));
      vec3Norm(vec3Cross(vz, vx, vy));
      vec3Cross(vx, unitVecs[vAxis], vz);
      vec3Scale(vx, vx, 1 / vx[uAxis]);
      vec3Cross(vy, vz, unitVecs[uAxis]);
      vec3Scale(vy, vy, 1 / vy[vAxis]);
      mat3SetVec(mat, vx, vy, vz);
      mat3Inverse(mat);
      for (let i = 0; i < 3; i++) {
        const vert = verts[i];
        vert[0] += x - minX;
        vert[1] += y - minY;
        mesh.set(vert, pos);
        mesh[pos + 3] = vert[uAxis];
        mesh[pos + 4] = vert[vAxis];
        mesh[pos + 5] = isEdge ? (i == 2 ? edgeDist : 0) : 1;
        mesh.set(vert, pos);
        mesh.set(mat, pos + 7);
        pos += levelVertexSize;
      }
    }
    const vc = 0.5;
    /* eslint-disable guard-for-in */
    for (const key in tiles) {
      /* eslint-enable guard-for-in */
      const z = tiles[key];
      [x, y] = key.split(',');
      x = +x;
      y = +y;
      grid[(y - minY) * sizeY + x - minX] = z;
      for (let side = 0; side < 4; side++) {
        const v0 = ((side + 0) >> 1) & 1; // y0
        const v1 = ((side + 1) >> 1) & 1; // x0, y1
        const v2 = ((side + 2) >> 1) & 1; // x1
        const nz = tiles[[
          x + neighbors[side + 1],
          y + neighbors[side],
        ]];
        emit(
          0, 1, nz != null && nz != z,
          [v1, v0, z],
          [v2, v1, z],
          [vc, vc, z],
        );
        if (nz != null && nz < z) {
          emit(
            side & 1, 2, 1,
            [v2, v1, z],
            [v1, v0, z],
            [(v1 + v2) / 2, (v0 + v1) / 2, nz],
          );
          emit(
            side & 1, 2, 1,
            [v1, v0, z],
            [v1, v0, nz],
            [(v1 + v2) / 2, (v0 + v1) / 2, nz],
          );
          emit(
            side & 1, 2, 1,
            [v2, v1, nz],
            [v2, v1, z],
            [(v1 + v2) / 2, (v0 + v1) / 2, nz],
          );
        }
      }
    }

    level.sizeX = sizeX;
    level.sizeY = sizeY;
    level.heightGrid = grid;
    level.mesh = mesh.slice(0, pos);
    level.vertexCount = pos / levelVertexSize;
  }

  // ===========================================================================
  // Prefabs
  // ===========================================================================

  let height;
  let minX, minY, maxX, maxY;

  // Add a single tile, if it's not already set.
  function addTile(x, y) {
    if (tiles[[x, y]] != null) {
      return;
    }
    minX = Math.min(x, minX);
    minY = Math.min(y, minY);
    maxX = Math.max(x, maxX);
    maxY = Math.max(y, maxY);
    tiles[[x, y]] = height;
  }

  // Make a rectangle floor.
  function floorRect(xo, yo, xs, ys) {
    for (let y = 0; y < ys; y++) {
      for (let x = 0; x < xs; x++) {
        addTile(xo + x, yo + y);
      }
    }
  }

  // Make a pyramid, a sequence of 'n' rectangles, each 1 unit smaller and
  // 'delta' taller.
  function pyramid(xo, yo, xs, ys, n, delta) {
    const base = height;
    for (let i = n - 1; i >= 0; i--) {
      height = base + delta * i;
      floorRect(xo + i, yo + i, xs - 2 * i, ys - 2 * i);
    }
  }

  // ===========================================================================
  // Start
  // ===========================================================================

  defineLevel(levelStart, () => {
    height = 3;
    addTile(1, 1);
    addTile(5, 1);
    addTile(1, 5);
    addTile(5, 5);
    height = 0;
    pyramid(0, 0, 7, 7, 3, 0.2);
  });

  // ===========================================================================

  // Define a level, given its number and a function to construct it.
  function defineLevel(levelNumber, constructor) {
    if (DEBUG) {
      if (levels[levelNumber]) {
        throw new Error(`Duplicate level definition ${levelNumber}`);
      }
    }
    const level = new Level(() => {
      tiles = {};
      minX = minY = 100;
      maxX = maxY = -100;
      constructor();
      createMesh(level);
    });
    levels[levelNumber] = level;
  }
}());
