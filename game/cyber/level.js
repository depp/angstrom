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

// Level names.
const levelStart = 0;

export const levelVertexSize = 16;

class Level {
  constructor(meshBuildFunc) {
    this.meshBuildFunc = meshBuildFunc;
    this.meshDirty = true;
  }

  bindMeshBuffer() {
    if (!this.meshBuffer) {
      this.meshBuffer = gl.createBuffer();
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffer);
    if (this.meshDirty) {
      const mesh = this.meshBuildFunc();
      this.vertexCount = mesh.length / levelVertexSize;
      gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
      this.meshDirty = false;
      // console.log(`Generated ${this.vertexCount} vertices`);
    }
    return this.vertexCount;
  }

  startLevel() {}
}

// Array of all levels.
export const levels = [];

(function makeLevels() {
  let tiles;

  // Add a single tile, if it's not already set.
  function addTile(...pos) {
    if (tiles[pos]) {
      return;
    }
    tiles[pos] = -Math.random();
  }

  // Get the value of a single tile.
  function getTile(...pos) {
    return tiles[pos];
  }

  // Make a rectangle floor.
  function floorRect(xo, yo, xs, ys) {
    for (let y = 0; y < ys; y++) {
      for (let x = 0; x < xs; x++) {
        addTile(xo + x, yo + y);
      }
    }
  }

  // Define a level, given its number and a function to construct it.
  function defineLevel(levelNumber, constructor) {
    if (DEBUG) {
      if (levels[levelNumber]) {
        throw new Error(`Duplicate level definition ${levelNumber}`);
      }
    }
    const level = new Level(() => {
      tiles = {};
      constructor();
      return createMesh();
    });
    levels[levelNumber] = level;
  }

  const neighbors = [-1, 0, 1, 0, -1];

  function createMesh() {
    let arr = new Float32Array(256);
    let pos = 0;
    let x;
    let y;
    const vx = [];
    const vy = [];
    const vz = [];
    const mat = new Float32Array(9);
    // Emit a single mesh triangle.
    function emit(uAxis, vAxis, isEdge, ...verts) {
      if (levelVertexSize * 3 > arr.length - pos) {
        const narr = new Float32Array(arr.length * 2);
        narr.set(arr);
        arr = narr;
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
        vert[0] += x;
        vert[1] += y;
        arr.set(vert, pos);
        arr[pos + 3] = vert[uAxis];
        arr[pos + 4] = vert[vAxis];
        arr[pos + 5] = isEdge ? (i == 2 ? edgeDist : 0) : 1;
        arr.set(vert, pos);
        arr.set(mat, pos + 7);
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
      for (let side = 0; side < 4; side++) {
        const v0 = ((side + 0) >> 1) & 1; // y0
        const v1 = ((side + 1) >> 1) & 1; // x0, y1
        const v2 = ((side + 2) >> 1) & 1; // x1
        emit(
          0, 1, 1,
          [v1, v0, z],
          [v2, v1, z],
          [vc, vc, z + 0.2],
        );
        const nz = getTile(
          x + neighbors[side + 1],
          y + neighbors[side],
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
    return arr.slice(0, pos);
  }

  // ===========================================================================
  // Start
  // ===========================================================================

  defineLevel(levelStart, () => {
    floorRect(0, 0, 7, 7);
  });

  // ===========================================================================
}());
