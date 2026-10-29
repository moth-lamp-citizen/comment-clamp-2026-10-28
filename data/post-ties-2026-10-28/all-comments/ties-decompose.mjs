import fs from 'node:fs';

// Decompose the post-deploy tie column by author arm and compare it with the pre-deploy
// inversion column under two denominators: all adjacent pairs, and pairs scaled by the
// positive sub-100 ms gap density (the part of the race the clamp cannot move).
// Reads rows.json ([id, created_at_ms, author]) from this directory.

const rows = JSON.parse(fs.readFileSync(new URL('./rows.json', import.meta.url)));
const SPLIT = 64064; // last pre-deploy id; pairs are counted only when both rows sit on one side
const pairs = [];
for (let i = 1; i < rows.length; i++) {
  const [id, t, au] = rows[i], [pid, pt, pau] = rows[i - 1];
  if (id !== pid + 1) continue;
  if ((id <= SPLIT) !== (pid <= SPLIT)) continue;
  pairs.push({ id, pid, t, pt, au, pau, g: t - pt, self: au === pau, pre: id <= SPLIT });
}
const cnt = (arr, fn) => arr.filter(fn).length;
const rate = (n, d) => +(1000 * n / d).toFixed(4);

function block(arr) {
  const o = { pairs: arr.length, self: cnt(arr, p => p.self), cross: cnt(arr, p => !p.self),
    inv: cnt(arr, p => p.g < 0), ties: cnt(arr, p => p.g === 0),
    sub100: cnt(arr, p => Math.abs(p.g) < 100), posSub100: cnt(arr, p => p.g > 0 && p.g < 100) };
  o.arms = {};
  for (const arm of [true, false]) {
    const a = arr.filter(p => p.self === arm);
    const inv = cnt(a, p => p.g < 0);
    o.arms[arm ? 'self' : 'cross'] = { pairs: a.length, inv, ties: cnt(a, p => p.g === 0),
      sub100: cnt(a, p => Math.abs(p.g) < 100), posSub100: cnt(a, p => p.g > 0 && p.g < 100),
      invRate: rate(inv, a.length), posSub100Rate: rate(cnt(a, p => p.g > 0 && p.g < 100), a.length) };
  }
  return o;
}

const pre = pairs.filter(p => p.pre), post = pairs.filter(p => !p.pre);
const P = block(pre), Q = block(post);
const exp = {};
for (const arm of ['self', 'cross']) {
  const e = P.arms[arm].invRate / 1000 * Q.arms[arm].pairs;
  const ratio = Q.arms[arm].posSub100Rate / P.arms[arm].posSub100Rate;
  exp[arm] = { unconditional: +e.toFixed(2), raceRatio: +ratio.toFixed(4),
    raceControlled: +(e * ratio).toFixed(2), observed: Q.arms[arm].ties,
    ratioObservedControlled: +(Q.arms[arm].ties / (e * ratio)).toFixed(3) };
}
exp.total = { unconditional: +(exp.self.unconditional + exp.cross.unconditional).toFixed(2),
  raceControlled: +(exp.self.raceControlled + exp.cross.raceControlled).toFixed(2),
  observed: Q.ties, ratio: +(Q.ties / (exp.self.raceControlled + exp.cross.raceControlled)).toFixed(3) };

const preInv = pre.filter(p => p.g < 0);
const lag = { total: preInv.length, ge100: cnt(preInv, p => Math.abs(p.g) >= 100),
  ge100Self: cnt(preInv, p => Math.abs(p.g) >= 100 && p.self),
  ge100Cross: cnt(preInv, p => Math.abs(p.g) >= 100 && !p.self),
  mostNegativeMs: Math.min(...preInv.map(p => p.g)) };
const share = {
  preInvCross: +(100 * cnt(preInv, p => !p.self) / preInv.length).toFixed(2),
  postTieCross: +(100 * cnt(post, p => p.g === 0 && !p.self) / cnt(post, p => p.g === 0)).toFixed(2),
  preSub100InvCross: +(100 * cnt(preInv, p => Math.abs(p.g) < 100 && !p.self) / cnt(preInv, p => Math.abs(p.g) < 100)).toFixed(2),
  preSub100PairsCross: +(100 * P.arms.cross.sub100 / P.sub100).toFixed(2),
  postSub100PairsCross: +(100 * Q.arms.cross.sub100 / Q.sub100).toFixed(2) };

const ties = pairs.filter(p => p.g === 0).sort((a, b) => a.id - b.id);
const runs = [];
for (const p of ties) {
  const last = runs[runs.length - 1];
  if (last && p.pid === last.end) last.end = p.id;
  else runs.push({ start: p.pid, end: p.id });
}
const postRuns = runs.filter(r => r.end > SPLIT);
const multi = runs.filter(r => r.end - r.start >= 2);

const out = { boundary: '2026-09-16T08:57:57Z', split_id: SPLIT, pre: P, post: Q, expectation: exp,
  pre_inversion_lag: lag, shares: share, tie_pairs_all: ties.length, tie_pairs_post: Q.ties,
  tie_runs_all: runs.length, tie_runs_post: postRuns.length, multi_tie_runs: multi,
  generated_by: 'ties-decompose.mjs' };
fs.writeFileSync(new URL('./ties-decomposition.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
