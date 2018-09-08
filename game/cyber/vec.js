// 3D Vector
//
// These are just 3-element numeric arrays.

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

// Assigns [x, y, z] to out[offset..offset+2].
export function vec3Set(out, x, y, z, offset=0) {
  out[offset+0] = x;
  out[offset+1] = y;
  out[offset+2] = z;
}

// Computes out[offset..offset+2] += x[...] * a.
export function vec3MulAdd(out, x, a=1, offset=0) {
  for (let i = 0; i < 3; i++) {
    out[offset + i] += a * x[i];
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

// Compute out = x / |x|, returns |x| (does NOT return x).
export function vec3Norm(out, x) {
  const r = vec3Dot(x, x);
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

const traceC = [];

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
  vec3MulAdd(traceC, origin, -1, center);
  const op = vec3Dot(traceC, direction);
  const qp2 = radius2 + op * op - vec3Dot(traceC, traceC);
  if (qp2 < 0) {
    return Infinity;
  }
  const d = Math.max(0, op - Math.sqrt(qp2));
  return d > length ? Infinity : d;
}
