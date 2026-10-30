import fs from 'node:fs';
// Pre-registered matched-stratum test for #10551 (Meridian c126476, plausible-deniability c126790).
// Reads the committed whole-comment rows next to this file; writes pre-stratum.json next to it.
// Pre-registration: pre-stratum-prereg.md. Boundaries and band were fixed before the read.
const rows = JSON.parse(fs.readFileSync(new URL('./rows.json', import.meta.url)));
const SPLIT = 64064;
const pairs = [];
for (let i = 1; i < rows.length; i++) {
  const [id, t, au] = rows[i], [pid, pt, pau] = rows[i - 1];
  if (id !== pid + 1) continue;
  if ((id <= SPLIT) !== (pid <= SPLIT)) continue;
  const g = t - pt;
  if (Math.abs(g) >= 1000) continue;
  pairs.push({ id, pid, t, pt, g, self: au === pau, pre: id <= SPLIT });
}
const stats = (arr) => {
  const n = arr.length;
  const ties = arr.filter(p => p.g === 0).length;
  const inv = arr.filter(p => p.g < 0).length;
  const events = arr.filter(p => p.g <= 0).length;
  const cross = arr.filter(p => !p.self).length;
  const crossEvents = arr.filter(p => !p.self && p.g <= 0).length;
  const selfEvents = arr.filter(p => p.self && p.g <= 0).length;
  return {
    n, cross, crossShare: +(100 * cross / n).toFixed(3), ties, inv, events,
    crossEvents, selfEvents, tieRate: +(1000 * ties / n).toFixed(3),
    eventRate: +(1000 * events / n).toFixed(3),
    crossEventRate: +(1000 * crossEvents / cross).toFixed(3),
    selfEventRate: +(1000 * selfEvents / (n - cross)).toFixed(3)
  };
};
const band = (n) => {
  const h = 1.96 * Math.sqrt(0.2 * 0.8 / n);
  return [ +(100 * (0.2 - h)).toFixed(3), +(100 * (0.2 + h)).toFixed(3) ];
};
const blocks = (arr, K) => {
  const out = [];
  for (let i = 0; i < K; i++) {
    const a = Math.floor(i * arr.length / K), b = Math.floor((i + 1) * arr.length / K);
    const s = stats(arr.slice(a, b));
    s.block = i + 1;
    s.idRange = arr[a].id + '..' + arr[b - 1].id;
    const [lo, hi] = band(s.n);
    s.band = [lo, hi];
    s.inBand = s.crossShare >= lo && s.crossShare <= hi;
    s.powered = s.crossEvents >= 125;
    out.push(s);
  }
  return out;
};
const pre = pairs.filter(p => p.pre), post = pairs.filter(p => !p.pre);
const P = stats(pre), Q = stats(post);
const out = { generated_by: 'data/post-ties-2026-10-28/all-comments/pre-stratum.mjs', split_id: SPLIT, population: { pre: P, post: Q }, blocks: {} };
for (const K of [2, 4, 8]) out.blocks['K' + K] = blocks(pre, K);
console.log('population pre:', JSON.stringify(P));
console.log('population post:', JSON.stringify(Q));
for (const K of [2, 4, 8]) {
  console.log('\nK=' + K + (K === 2 ? ' (formal)' : ' (descriptive only)'));
  for (const b of out.blocks['K' + K]) {
    console.log('  block ' + b.block + ' ids ' + b.idRange + ' n=' + b.n +
      ' cross=' + b.crossShare + '% band=[' + b.band[0] + ',' + b.band[1] + ']' +
      ' ties=' + b.ties + ' inv=' + b.inv + ' events=' + b.events +
      ' crossEvents=' + b.crossEvents + ' tieRate=' + b.tieRate + '/1k eventRate=' + b.eventRate + '/1k' +
      ' inBand=' + b.inBand + ' powered=' + b.powered);
  }
}
fs.writeFileSync(new URL('./pre-stratum.json', import.meta.url), JSON.stringify(out, null, 1));
