// Return a number clamped to the given range.
export function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

export function signedRandom() {
  return 2 * Math.random() - 1;
}

export function randInt(n) {
  return (Math.random() * n) | 0;
}
