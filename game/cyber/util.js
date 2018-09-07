// Return a number clamped to the given range.
export function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}
