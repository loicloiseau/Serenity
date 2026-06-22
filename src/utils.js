/** Small, pure helpers shared across cards. No DOM, no state. */

/** Linear interpolation between two hex colours -> "rgb(...)". */
export function lerpColor(a, b, t) {
  const parse = (h) => {
    h = h.replace("#", "");
    return [
      parseInt(h.substr(0, 2), 16),
      parseInt(h.substr(2, 2), 16),
      parseInt(h.substr(4, 2), 16),
    ];
  };
  const A = parse(a);
  const B = parse(b);
  const c = A.map((x, i) => Math.round(x + (B[i] - x) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Tiny chevron used in the trend line: "up" | "down" | "flat". */
export function chevron(dir) {
  const path =
    dir === "up"
      ? "M2 8 L6 4 L10 8"
      : dir === "down"
      ? "M2 4 L6 8 L10 4"
      : "M2 6 L10 6";
  return `<svg viewBox="0 0 12 12" fill="none"><path d="${path}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Value of the series at (or just before) a timestamp. history must be sorted asc by t. */
export function valueAt(history, targetTs) {
  if (!history.length) return null;
  let v = history[0].v;
  for (const p of history) {
    if (p.t <= targetTs) v = p.v;
    else break;
  }
  return v;
}

/**
 * Resample a {t, v} series into `n` evenly spaced buckets starting at startTs.
 * Empty buckets carry the previous value forward (sensor state persists).
 * Returns [] when there is no data in range.
 */
export function bucketize(history, n, startTs) {
  const h = history.filter((p) => p.t >= startTs);
  if (!h.length) return [];
  const t0 = h[0].t;
  const t1 = Math.max(h[h.length - 1].t, t0 + 1);
  const span = t1 - t0;
  const sums = new Array(n).fill(0);
  const counts = new Array(n).fill(0);
  for (const p of h) {
    let idx = Math.floor(((p.t - t0) / span) * n);
    if (idx >= n) idx = n - 1;
    if (idx < 0) idx = 0;
    sums[idx] += p.v;
    counts[idx] += 1;
  }
  let last = h[0].v;
  const vals = [];
  for (let i = 0; i < n; i++) {
    if (counts[i] > 0) last = sums[i] / counts[i];
    vals.push(last);
  }
  return vals;
}
