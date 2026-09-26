// Deterministic pseudo-random helpers. The seed inventory must be byte-for-byte
// reproducible: same seed -> same jobs, listings, ids. Never use Math.random().

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  const rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    /** weighted pick: entries = [[value, weight], ...] */
    weighted(entries) {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of entries) { r -= w; if (r <= 0) return v; }
      return entries[entries.length - 1][0];
    },
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
    sample(arr, n) { return rng.shuffle(arr).slice(0, Math.min(n, arr.length)); },
    /** uniform float in [min,max), rounded to `step` (e.g. 0.25) */
    stepped(min, max, step) { return Math.round((min + next() * (max - min)) / step) * step; },
  };
  return rng;
}

/** Small stable string hash -> 32-bit int (for per-ZIP coordinate jitter). */
export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function slugify(s) {
  return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
