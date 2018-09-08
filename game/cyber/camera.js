import { canvas } from '/game/cyber/global';
import { vec3MulAdd } from '/game/cyber/vec';
import { playerPos, playerAngle } from '/game/cyber/player';

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
// Matrix to be multiplied into the camera matrix.
const componentMatrix = new Float32Array(16);
// Scratch matrix for multiplication.
const scratchMatrix = new Float32Array(16);

// Update the camera matrix.  We don't use matrices anywhere else in
// the code, so all matrix math is inlined here.
export function updateCamera() {
  // ========================================
  // Identity matrix
  function identity() {
    componentMatrix.fill(0);
    componentMatrix[0] = 1;
    componentMatrix[5] = 1;
    componentMatrix[10] = 1;
    componentMatrix[15] = 1;
  }

  // Matrix multiplication
  //
  // Computes camera = camera * component, uses scratch for scratch space
  function matMul() {
    let i, j, k, s;
    // c_ij = a_ik * b_kj
    for (j = 0; j < 4; j++) {
      for (i = 0; i < 4; i++) {
        s = 0;
        for (k = 0; k < 4; k++) {
          s += cameraMatrix[i+k*4] * componentMatrix[k+j*4];
        }
        scratchMatrix[i+j*4] = s;
      }
    }
    cameraMatrix.set(scratchMatrix);
  }

  // ========================================
  // Projection matrix
  //
  // [ 1 / mx, 0, 0, 0 ]
  // [ 0, 1 / my, 0, 0 ]
  // [ 0, 0, -(far + near) / (far - near), -2 * far * near / (far - near) ]
  // [ 0, 0, -1, 0 ]
  const zNear = 0.1, zFar = 20;
  const mx = 1, my = canvas.clientHeight / canvas.clientWidth;
  cameraMatrix.fill(0);
  cameraMatrix[0] = 0.5/mx;
  cameraMatrix[5] = 0.5/my;
  cameraMatrix[10] = (zNear + zFar) / (zNear - zFar);
  cameraMatrix[11] = -1;
  cameraMatrix[14] = 2 * zNear * zFar / (zNear - zFar);

  // ========================================
  // Rotation matrices
  //
  // Roll, pitch, yaw
  function Rotate(axis, angle) {
    const [c1, c2, s1, s2] = axis ? [0, 5, 1, 4] : [5, 10, 6, 9];
    identity();
    componentMatrix[c1] = componentMatrix[c2] = Math.cos(angle);
    componentMatrix[s1] = -(componentMatrix[s2] = Math.sin(angle));
    matMul();
  }
  Rotate(1, playerAngle[2]);
  Rotate(0, playerAngle[1] + 0.5 * Math.PI);
  Rotate(1, playerAngle[0] - 0.5 * Math.PI);

  // ========================================
  // Translation matrix
  identity();
  vec3MulAdd(componentMatrix, playerPos, -1, 12);
  matMul();
}
