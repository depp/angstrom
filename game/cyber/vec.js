// 3D Vector
//
// These are just 3-element numeric arrays.

export function vec2Eq([x1, y1], [x2, y2]) {
  return x1 == x2 && y1 == y2;
}

export function vec2Rect([x1, y1], [x2, y2, w2, h2]) {
  return (x1 >= x2 && x1 < (x2 + w2)
          && y1 >= y2 && y1 < (y2 + h2));
}

const vecZero = [0, 0, 0];

// Assigns [x, y, z] to out.
export function vecSet(out, x, y, z) {
  out[0] = x;
  out[1] = y;
  out[2] = z;
}

// Computes out = a * x + y, returns out.
export function vecMulAdd(out, x, a=1, y=vecZero) {
  for (let i = 0; i < 3; i++) {
    out[i] = a * x[i] + y[i];
  }
  return out;
}

// Compute dot product.
export function vecDot(x, y) {
  let a = 0, i;
  for (i = 0; i < 3; i++) {
    a += x[i] * y[i];
  }
  return a;
}

// Compute out = x / |x|, returns |x| (does NOT return x).
export function vecNorm(out, x) {
  const r = vecDot(x, x);
  let i;
  if (r > 1e-8) {
    for (i = 0; i < 3; i++) {
      out[i] = x[i] / Math.sqrt(r);
    }
  } else {
    out[0] = 0;
    out[1] = 0;
    out[2] = 1;
  }
  return r;
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
  const c = vecMulAdd([], origin, -1, center);
  const op = vecDot(c, direction);
  const qp2 = radius2 + op * op - vecDot(c, c);
  if (qp2 < 0) {
    return Infinity;
  }
  const d = Math.max(0, op - Math.sqrt(qp2));
  return d > length ? Infinity : d;
}
