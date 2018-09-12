// 3D Vector
//
// These are just 3-element numeric arrays.

const vTemp = [];
export const vecZero = [0, 0, 0];
export const vecX = [1, 0, 0];
export const vecY = [0, 1, 0];
export const vecZ = [0, 0, 1];
export const unitVecs = [vecX, vecY, vecZ];

// Assigns [x, y] to out[offset..offset+1].
export function vec2Set(out, x, y, offset=0) {
  out[offset+0] = x;
  out[offset+1] = y;
}

export function vec2Eq([x1, y1], [x2, y2]) {
  return x1 == x2 && y1 == y2;
}

export function vec2Rect([x1, y1], [x2, y2, w2, h2]) {
  return (x1 >= x2 && x1 < (x2 + w2)
          && y1 >= y2 && y1 < (y2 + h2));
}

export function vec2Distance(x, y) {
  return ((x[0] - y[0]) ** 2) + ((x[1] - y[1]) ** 2);
}

// Assigns [x, y, z] to out[offset..offset+2].
export function vec3Set(out, x, y, z, offset=0) {
  out[offset+0] = x;
  out[offset+1] = y;
  out[offset+2] = z;
}

// Assigns out = x, returns out.
export function vec3Copy(out, x) {
  for (let i = 0; i < 3; i++) {
    out[i] = x[i] || 0;
  }
  return out;
}

// Compute out = x * a, returns out.
export function vec3Scale(out, x, a) {
  for (let i = 0; i < 3; i++) {
    out[i] = x[i] * a;
  }
  return out;
}

// Compute out = x - y, returns out.
export function vec3Sub(out, x, y) {
  for (let i = 0; i < 3; i++) {
    out[i] = x[i] - y[i];
  }
  return out;
}

// Returns the distance between x and y.
export function vec3Distance(x, y = vecZero) {
  return Math.sqrt(
    ((x[0] - y[0]) ** 2)
      + ((x[1] - y[1]) ** 2)
      + ((x[2] - y[2]) ** 2),
  );
}

// Computes out = x + y * a. If x is not specified, defaults to out. Returns
// out.
export function vec3MulAdd(out, x, y, a=1, offset=0) {
  x = x || out;
  for (let i = 0; i < 3; i++) {
    out[offset + i] = x[i] + y[i] * a;
  }
  return out;
}

// Computes out += x * a.
export function vec3SetMulAdd(out, x, a=1, offset=0) {
  for (let i = 0; i < 3; i++) {
    out[offset + i] += x[i] * a;
  }
}

// Compute dot product.
export function vec3Dot(x, y) {
  let a = 0, i;
  for (i = 0; i < 3; i++) {
    a += x[i] * y[i];
  }
  return a;
}

// Compute out = x * scale / |x|, returns out. If x is unspecified, out is used.
export function vec3Norm(out, x, scale = 1) {
  x = x || out;
  const r = vec3Dot(x, x);
  let i;
  if (r > 1e-8) {
    for (i = 0; i < 3; i++) {
      out[i] = scale / Math.sqrt(r) * x[i];
    }
  } else {
    out[0] = 0;
    out[1] = 0;
    out[2] = scale;
  }
  return out;
}

// Compute the cross product of x and y, store in out. Returns out.
export function vec3Cross(out, x, y) {
  vec3Set(
    out,
    x[1] * y[2] - x[2] * y[1],
    x[2] * y[0] - x[0] * y[2],
    x[0] * y[1] - x[1] * y[0],
  );
  return out;
}

export function quatSet(out, x, y, z, w) {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[4] = w;
}

export function quatMul(out, x, y) {
  quatSet(
    out,
    x[3] * y[0] + x[0] * y[3] + x[1] * y[2] - y[2] * x[1],
    x[3] * y[1] + x[1] * y[3] + x[2] * y[0] - y[0] * x[2],
    x[3] * y[2] + x[2] * y[3] + x[0] * y[1] - y[1] * x[0],
    x[3] * y[3] - x[0] * y[0] - x[1] * y[1] - x[2] * y[2],
  );
}

// Test ray intersection against sphere. If the ray intersects the sphere,
// return the intersection distance along the ray. Otherwise, return Infinity.
//
// origin vec3: ray origin
// direction vec3: ray direction, normalized
// length number: maximum distance from origin to test
// center vec3: center of sphere
// radius2 number: squared radius of sphere
export function traceSphere(origin, direction, length, center, radius2) {
  // Let O be the origin, C be the circle center, let P be the closest
  // point on the ray to O, let Q be the first intersection of the ray
  // with the circle.
  //
  // |OC|^2 = |OP|^2 + |PC|^2
  // --> |PC|^2 = |OC|^2 - |OP|^2
  // |QC|^2 = |QP|^2 + |PC|^2
  // --> |QP|^2 = |QC|^2 - |PC|^2
  // --> |QP|^2 = |QC|^2 - |OC|^2 + |OP|^2
  vec3MulAdd(vTemp, origin, -1, center);
  const op = vec3Dot(vTemp, direction);
  const qp2 = radius2 + op * op - vec3Dot(vTemp, vTemp);
  if (qp2 < 0) {
    return Infinity;
  }
  const d = Math.max(0, op - Math.sqrt(qp2));
  return d > length ? Infinity : d;
}

// Set a 3x3 matrix from the column vectors x, y, z.
export function mat3SetVec(out, x, y, z) {
  out.set(x, 0);
  out.set(y, 3);
  out.set(z, 6);
  return out;
}

// 0 3 6
// 1 4 7
// 2 5 8

const tempMatrix = new Float32Array(9);
export function mat3Inverse(out, x) {
  x = x || out;
  // Calculate cofactors.
  for (let i = 0; i < 3; i++) {
    const i1 = (i + 1) % 3;
    const i2 = (i + 2) % 3;
    for (let j = 0; j < 3; j++) {
      const j1 = (j + 1) % 3;
      const j2 = (j + 2) % 3;
      tempMatrix[i * 3 + j] = (
        x[i1 * 3 + j1] * x[i2 * 3 + j2]
          + x[i1 * 3 + j2] * x[i2 * 3 + j1]);
    }
  }
  const scale = 1 / (
    x[0] * tempMatrix[0]
      + x[1] * tempMatrix[1]
      + x[2] * tempMatrix[2]);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i * 3 + j] = tempMatrix[i * 3 + j] * scale;
    }
  }
  return out;
}

export function mat3ToString(x) {
  const rows = [];
  const row = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      row.push(x[j * 3 + i]);
    }
    rows.push(row.join(' '));
    row.length = 0;
  }
  return rows.join('\n');
}
