#!/usr/bin/env node
// Re-walk the pre-clamp comment stream and print the summary in data/old-stream-summary.json.
// Public GETs only; no key. Pace: 2 s between requests (published limit 10/10 s; ~5/10 s measured safe).
const START = 35645, STOP = 62288, BASE = "https://1f916.ai";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rows = new Map();
let cursor = START, pages = 0, hasMore = true, next = null;
while (hasMore) {
  const url = BASE + "/api/changes?posts_since=done&comments_since=id:" + cursor + "&nulls_since=done";
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status + " at page " + (pages + 1));
  const d = await r.json();
  for (const c of d.comments || []) rows.set(c.id, c);
  pages++;
  next = d.next_comments_since;
  hasMore = !!d.has_more;
  const nextId = typeof next === "string" && next.startsWith("id:") ? Number(next.slice(3)) : null;
  if (!hasMore || nextId === null || nextId > STOP) break;
  cursor = nextId;              // the route returns ids > cursor; do not subtract 1
  await sleep(2000);
}
const ids = [...rows.keys()].filter(i => i >= 35646 && i <= STOP).sort((a, b) => a - b);
const seq = ids.map(i => rows.get(i));
const gaps = ids.reduce((n, id, k) => n + (k && id !== ids[k-1] + 1 ? 1 : 0), 0);
let inversions = 0, cross = 0, self = 0, exact = 0, ties = 0, max = -Infinity;
const inv = [];
for (let k = 0; k < seq.length; k++) {
  const c = seq[k];
  if (k > 0 && c.created_at <= max) ties++;
  if (c.created_at > max) max = c.created_at;
  if (k === 0) continue;
  const p = seq[k-1];
  if (c.created_at === p.created_at) exact++;
  if (c.created_at < p.created_at) {
    inversions++;
    if (p.author === c.author) self++; else cross++;
    inv.push([p.id, c.id, p.author, c.author, c.created_at - p.created_at]);
  }
}
const spanDays = (seq.at(-1).created_at - seq[0].created_at) / 86400000;
const summary = {
  ids: [ids[0], ids.at(-1)], rows: seq.length, pairs: seq.length - 1, id_gaps: gaps,
  first_created_at: seq[0].created_at, last_created_at: seq.at(-1).created_at,
  span_days: spanDays, inversions, inversions_per_day: inversions / spanDays,
  cross_author_inversions: cross, self_author_inversions: self,
  exact_ties: exact, ties_under_clamp: ties,
  first_examples: inv.slice(0, 2), last_examples: inv.slice(-2)
};
console.log(JSON.stringify(summary, null, 1));
