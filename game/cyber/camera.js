import { canvas } from '/game/cyber/global';
import { vecZero, vec3SetMulAdd } from '/game/cyber/vec';

// ========================================
// Matrix layout
//
// [ 0  4  8 12 ]
// [ 1  5  9 13 ]
// [ 2  6 10 14 ]
// [ 3  7 11 15 ]
//
// m_ij = m[i+j*4]

// The model view projection matrix.
export const cameraMatrix = new Float32Array(16);
// The model view projection matrix for the UI.
export const uiMatrix = new Float32Array(16);
// Matrix to be multiplied into the camera matrix.
const componentMatrix = new Float32Array(16);
// Scratch matrix for multiplication.
const scratchMatrix = new Float32Array(16);

// The entity which is the current camera.
export let cameraEntity;

// Position of camera, do not modify, it aliases things.
export let cameraPos;

// Set the current camera. The camera must have an angle attribute:
//
// angle: [yaw, pitch, roll]
export function setCamera(entity) {
  cameraEntity = entity;
}

// Matrix multiplication
//
// Computes out = out * componentMatrix, uses scratch for scratch space
function matMul(out) {
  let i, j, k, s;
  // c_ij = a_ik * b_kj
  for (j = 0; j < 4; j++) {
    for (i = 0; i < 4; i++) {
      s = 0;
      for (k = 0; k < 4; k++) {
        s += out[i+k*4] * componentMatrix[k+j*4];
      }
      scratchMatrix[i+j*4] = s;
    }
  }
  out.set(scratchMatrix);
}

// Set componentMatrix to the identity.
function identity() {
  componentMatrix.fill(0);
  componentMatrix[0] = 1;
  componentMatrix[5] = 1;
  componentMatrix[10] = 1;
  componentMatrix[15] = 1;
}

// Multiply cameraMatrix by a rotation matrix.
//
// axis: 1 for Z axis, 0 for X axis
function rotate(axis, angle) {
  const [c1, c2, s1, s2] = axis ? [0, 5, 1, 4] : [5, 10, 6, 9];
  identity();
  componentMatrix[c1] = componentMatrix[c2] = Math.cos(angle);
  componentMatrix[s1] = -(componentMatrix[s2] = Math.sin(angle));
  matMul(cameraMatrix);
}

// Update the camera matrices.
export function updateCamera() {
  // Set up orthographic projection matrix.
  uiMatrix.fill(0);
  uiMatrix[0] = canvas.clientHeight / canvas.clientWidth;
  uiMatrix[5] = 1;
  uiMatrix[10] = 1;
  uiMatrix[15] = 1;

  cameraPos = vecZero;

  // Set up the main camera.
  if (!cameraEntity) {
    return;
  }
  if (cameraEntity.dead) {
    cameraEntity = null;
    return;
  }
  const { pos, angle } = cameraEntity;
  cameraPos = pos;

  // Set up projection matrix.
  //
  // zNear: near Z clip plane
  // zFar: far Z clip plane
  // mx: slope of X clip planes, mx = tan(fovX / 2)
  // my: slope of Y clip planes, my = tan(fovY / 2)
  //
  // [ 1 / mx, 0, 0, 0 ]
  // [ 0, 1 / my, 0, 0 ]
  // [ 0, 0, -(far + near) / (far - near), -2 * far * near / (far - near) ]
  // [ 0, 0, -1, 0 ]
  const zNear = 0.1, zFar = 20;
  const mx = 0.7, my = mx * canvas.clientHeight / canvas.clientWidth;
  cameraMatrix.fill(0);
  cameraMatrix[0] = 0.5/mx;
  cameraMatrix[5] = 0.5/my;
  cameraMatrix[10] = (zNear + zFar) / (zNear - zFar);
  cameraMatrix[11] = -1;
  cameraMatrix[14] = 2 * zNear * zFar / (zNear - zFar);

  // Rotate
  rotate(1, angle[2]);
  rotate(0, angle[1] + 0.5 * Math.PI);
  rotate(1, angle[0] - 0.5 * Math.PI);

  // Translate
  identity();
  vec3SetMulAdd(componentMatrix, pos, -1, 12);
  matMul(cameraMatrix);
}
