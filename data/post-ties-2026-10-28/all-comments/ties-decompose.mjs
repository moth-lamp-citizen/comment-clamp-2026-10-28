import fs from 'node:fs';

// Decompose the post-deploy tie column by author arm, in two windows:
//   sub-second  |gap| < 1000 ms  (contains every pre-deploy inversion; earliest is -514 ms)
//   tight       |gap| <  100 ms  (excludes the 61 pre inversions older than 100 ms)
// and, as a bound, over all adjacent pairs. Reads rows.json ([id, created_at_ms, author]).
// Rates are per 1,000 pairs. "Expected" applies the pre-deploy per-arm (inversions + ties) rate
// to the post-deploy pair count in the same arm; "blended" applies the pooled pre rate.

const rows = JSON.parse(fs.readFileSync(new URL('./rows.json', import.meta.url)));
const SPLIT = 64064; // last pre-deploy id; pairs counted only when both rows sit on one side
const pairs = [];
for (let i = 1; i < rows.length; i++) {
  const [id, t, au] = rows[i], [pid, pt, pau] = rows[i - 1];
  if (id !== pid + 1) continue;
  if ((id <= SPLIT) !== (pid <= SPLIT)) continue;
  pairs.push({ id, pid, t, pt, au, pau, g: t - pt, self: au === pau, pre: id <= SPLIT });
}
const cnt = (a, f) => a.filter(f).length;
const r4 = (n, d) => +(1000 * n / d).toFixed(4);

function stats(arr, maxGap) {
  const sub = arr.filter(p => Math.abs(p.g) < maxGap);
  const o = { pairs: sub.length, self: cnt(sub, p => p.self), cross: cnt(sub, p => !p.self),
    inv: cnt(sub, p => p.g < 0), ties: cnt(sub, p => p.g === 0) };
  o.arms = {};
  for (const arm of [true, false]) {
    const a = sub.filter(p => p.self === arm);
    o.arms[arm ? 'self' : 'cross'] = { pairs: a.length, inv: cnt(a, p => p.g < 0),
      ties: cnt(a, p => p.g === 0), rate: r4(cnt(a, p => p.g < 0) + cnt(a, p => p.g === 0), a.length) };
  }
  o.blendedRate = r4(o.inv + o.ties, o.pairs);
  return o;
}

function standardise(preW, postW, label) {
  const out = { window: label, arms: {}, total: {} };
  for (const arm of ['self', 'cross']) {
    const pr = preW.arms[arm].rate / 1000, exp = +(pr * postW.arms[arm].pairs).toFixed(2);
    out.arms[arm] = { preRate: preW.arms[arm].rate, postPairs: postW.arms[arm].pairs,
      expected: exp, observed: postW.arms[arm].ties,
      ratio: +(postW.arms[arm].ties / exp).toFixed(3) };
  }
  const exp = out.arms.self.expected + out.arms.cross.expected;
  out.total = { expected: +exp.toFixed(2), observed: postW.ties, ratio: +(postW.ties / exp).toFixed(3),
    blendedExpected: +((preW.blendedRate / 1000) * postW.pairs).toFixed(2) };
  return out;
}

const pre = pairs.filter(p => p.pre), post = pairs.filter(p => !p.pre);
const sub = { pre: stats(pre, 1000), post: stats(post, 1000) };
const tight = { pre: stats(pre, 100), post: stats(post, 100) };
const allp = { pre: stats(pre, 1e15), post: stats(post, 1e15) };
const preInv = pre.filter(p => p.g < 0);

const out = {
  boundary: '2026-09-16T08:57:57Z', split_id: SPLIT,
  windows: {
    sub_second: { pre: sub.pre, post: sub.post, standardised: standardise(sub.pre, sub.post, 'sub_second') },
    tight_100ms: { pre: tight.pre, post: tight.post, standardised: standardise(tight.pre, tight.post, 'tight_100ms') },
    all_pairs: { pre: allp.pre, post: allp.post, standardised: standardise(allp.pre, allp.post, 'all_pairs') },
  },
  pre_inversion_lag: {
    total: preInv.length, ge100: cnt(preInv, p => Math.abs(p.g) >= 100),
    ge100Self: cnt(preInv, p => Math.abs(p.g) >= 100 && p.self),
    ge100Cross: cnt(preInv, p => Math.abs(p.g) >= 100 && !p.self),
    mostNegativeMs: Math.min(...preInv.map(p => p.g)),
  },
  generated_by: 'ties-decompose.mjs',
};
fs.writeFileSync(new URL('./ties-decomposition.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
