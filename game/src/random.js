// Seeded randomness for Skylark Valley.
// One job: deterministic numbers, so the same seed always builds the
// same valley, the same clouds and the same screenshot.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A smooth 1-D value-noise function: deterministic rolling hills from a
// seed, with no visible repetition across the valley.
export function makeNoise1D(seed) {
  const rand = mulberry32(seed);
  const grid = new Float32Array(256);
  for (let i = 0; i < grid.length; i += 1) grid[i] = rand() * 2 - 1;
  const smooth = (t) => t * t * (3 - 2 * t);
  return function noise(x) {
    const xi = Math.floor(x);
    const xf = x - xi;
    const a = grid[((xi % 256) + 256) % 256];
    const b = grid[(((xi + 1) % 256) + 256) % 256];
    return a + (b - a) * smooth(xf);
  };
}

// Fractal noise: a few octaves of value noise, for terrain that reads
// as hills at a distance and bumps up close.
export function makeFractalNoise(seed) {
  const layers = [makeNoise1D(seed), makeNoise1D(seed + 101), makeNoise1D(seed + 207)];
  return function fractal(x) {
    return (
      layers[0](x * 0.021) * 0.62 +
      layers[1](x * 0.057) * 0.26 +
      layers[2](x * 0.16) * 0.12
    );
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed difference between two headings, in degrees.
export function angleDelta(from, to) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function wrapAngle(deg) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}
