// Return a number clamped to the given range.
export function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

export function signedRandom(minMag = 0) {
  const x = 2 * Math.random() - 1;
  return x > 0 ? x + minMag : x - minMag;
}

export function randInt(n = 2) {
  return (Math.random() * n) | 0;
}

export function chooseRandom(arr, defaultValue = null) {
  if (arr.length == 0) {
    return defaultValue;
  }
  return arr[randInt(arr.length)];
}
