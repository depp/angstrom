import { gl } from '/game/cyber/global';

// Level names.
const levelStart = 0;

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
      console.log(`SZ: ${mesh.length}`);
      this.vertexCount = mesh.length / 5;
      gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
      this.meshDirty = false;
      console.log(`Generated ${this.vertexCount} vertices`);
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
    tiles[pos] = 1;
  }

  /*
  // Get the value of a single tile.
  function getTile(...pos) {
    return tiles[pos];
  }
  */

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

  function createMesh() {
    let arr = new Float32Array(256);
    let pos = 0;
    let x;
    let y;
    // Emit a single mesh triangle.
    function emit(uAxis, vAxis, ...verts) {
      if (5 * 3 > arr.length - pos) {
        const narr = new Float32Array(arr.length * 2);
        narr.set(arr);
        arr = narr;
      }
      for (const vert of verts) {
        vert[0] += x;
        vert[1] += y;
        vert[3] = vert[uAxis];
        vert[4] = vert[vAxis];
        arr.set(vert, pos);
        pos += 5;
      }
    }
    const vc = 0.5;
    /* eslint-disable guard-for-in */
    for (const key in tiles) {
      /* eslint-enable guard-for-in */
      [x, y] = key.split(',');
      x = +x;
      y = +y;
      const z = -Math.random();
      for (let side = 0; side < 4; side++) {
        const v0 = ((side + 0) >> 1) & 1; // y0
        const v1 = ((side + 1) >> 1) & 1; // x0, y1
        const v2 = ((side + 2) >> 1) & 1; // x1
        emit(
          0, 1,
          [v1, v0, z],
          [v2, v1, z],
          [vc, vc, z + 0.2],
        );
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
