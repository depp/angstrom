// Module render_sprite contains the sprite rendering code.
import { gl } from '/game/cyber/global';
import { cameraMatrix } from '/game/cyber/camera';
import { spriteProgram } from '/game/cyber/shaders';
import { frameDT } from '/game/cyber/time';
import { playerPos } from '/game/cyber/player';
import {
  vecZero, vec2Set, vec3MulAdd, vec3SetMulAdd, vec3Norm, vec3Cross,
} from '/game/cyber/vec';
import {
  emojiTexture, people,
} from '/game/cyber/emoji';
import { signedRandom } from '/game/cyber/util';

const vertexBuffer = gl.createBuffer();

// A unit quad as two triangles. XY and UV coordinates.
const quad = [
  [-1, -1, 0, 1],
  [ 1, -1, 1, 1],
  [-1,  1, 0, 0],
  [-1,  1, 0, 0],
  [ 1, -1, 1, 1],
  [ 1,  1, 1, 0],
];

const vecZ = [0, 0, 1];

class Swarm {
  constructor(n) {
    this.sprites = [];
    this.pos = [0, 0, 1];
    for (let i = 0; i < n; i++) {
      this.sprites.push({
        n: i % 8,
        pos: [signedRandom(), signedRandom(), signedRandom()],
        vel: [signedRandom(), signedRandom(), signedRandom()],
      });
    }
  }

  update() {
    for (const sprite of this.sprites) {
      for (let i = 0; i < 3; i++) {
        let p = sprite.pos[i], v = sprite.vel[i];
        p += v * frameDT;
        if (p < -1) {
          p = -2 - p;
          v = -v;
        } else if (p > 1) {
          p = 2 - p;
          v = -v;
        }
        sprite.pos[i] = p;
        sprite.vel[i] = v;
      }
    }
  }
}

class Person {
  constructor(i) {
    const person = people[i];
    this.phase = 0;
    this.offsets = new Float32Array(6 * 3);
    this.pos = [
      i - 10, // 4 * signedRandom(),
      0, // 4 * signedRandom(),
      0.5,
    ];
    this.sprites = [{
      n: person.head,
      pos: [0, 0, 0],
      size: 0.2,
    }, {
      n: person.shirt,
      pos: [0, 0, 0],
      size: 0.25,
    }, {
      n: person.hand,
      pos: [0, 0, 0],
      size: 0.1,
      rotate: 180,
    }, {
      n: person.hand,
      pos: [0, 0, 0],
      size: 0.1,
      flip: true,
      rotate: 180,
    }, {
      n: person.shoe,
      pos: [0, 0, 0],
      size: 0.15,
    }, {
      n: person.shoe,
      pos: [0, 0, 0],
      size: 0.15,
      flip: true,
    }];
    for (let i = 0; i < 6; i++) {
      this.sprites[i].offset = this.offsets.subarray(i * 3, i * 3 + 3);
    }
  }

  update() {
    this.phase = (this.phase + frameDT * 4) % (2 * Math.PI);
    const s = Math.sin(this.phase);
    this.offsets.set([
      0, 0.2 + Math.abs(s) * 0.05, 2,
      0, -0.1 + Math.abs(s) * 0.03, 1,
      0.15, -0.2 - s * 0.04, 3,
      -0.15, -0.2 + s * 0.04, 3,
      0.15, -0.3 + Math.max(0, s) * 0.06, 0,
      -0.15, -0.3 + Math.max(0, -s) * 0.06, 0,
    ]);
  }
}
console.log(people);

const groups = [];
groups.push(new Swarm(20));
groups.length = 0;
for (let i = 0; i < 20; i++) {
  groups.push(new Person(i));
}

export function renderSprite() {
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  let nSprite = 0;
  for (const group of groups) {
    group.update();
    nSprite += group.sprites.length;
  }
  const arr = new Float32Array(5 * 6 * nSprite);
  let i = 0;
  const pos = [];
  const right = [];
  const up = [];
  const forward = [];
  for (const group of groups) {
    vec3MulAdd(forward, group.pos, playerPos, -1);
    vec3Norm(forward);
    vec3Cross(right, forward, vecZ);
    vec3Norm(right);
    vec3Cross(up, right, forward);
    vec3Norm(up);
    for (const sprite of group.sprites) {
      vec3MulAdd(pos, group.pos, sprite.pos);
      /* eslint prefer-const: off */
      const {
        n, size, offset = vecZero, rotate = 0, flip = false,
      } = sprite;
      const cc = Math.cos(Math.PI / 180 * rotate);
      const ss = Math.sin(Math.PI / 180 * rotate);
      for (let j = 0; j < 6; j++) {
        let [r, s, u, v] = quad[j];
        if (flip) {
          u = 1 - u;
        }
        let r2 = r * cc - s * ss;
        let s2 = s * cc + r * ss;
        vec3SetMulAdd(arr, pos,     1,                      i + 5 * j);
        vec3SetMulAdd(arr, right,   r2 * size + offset[0],  i + 5 * j);
        vec3SetMulAdd(arr, up,      s2 * size + offset[1],  i + 5 * j);
        vec3SetMulAdd(arr, forward, -0.01 * offset[2],      i + 5 * j);
        vec2Set(arr, ((n & 7) + u) / 8, ((n >> 3) + v) / 8, i + 5 * j + 3);
      }
      i += 5 * 6;
    }
  }
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);

  const p = spriteProgram;
  if (!p || !emojiTexture) {
    return;
  }

  gl.enable(gl.DEPTH_TEST);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(p.program);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
  gl.uniformMatrix4fv(p.M, false, cameraMatrix);

  gl.drawArrays(gl.TRIANGLES, 0, nSprite * 6);

  gl.disableVertexAttribArray(1);
  gl.disable(gl.DEPTH_TEST);
}
