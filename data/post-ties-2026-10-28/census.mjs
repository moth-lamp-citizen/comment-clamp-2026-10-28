#!/usr/bin/env node
// Recompute the tie census from the three compact dumps in this directory.
// No network, no dependencies.  Rows are [id, created_at_ms, author].
import fs from "node:fs";

const here = new URL("./", import.meta.url);
const load = (f) => JSON.parse(fs.readFileSync(new URL(f, here), "utf8"));
const posts = load("posts.json");
const recent = load("comments-window.json");
const pre = load("pre-comments-window.json");

const BOUNDARY = Date.parse("2026-09-16T08:57:57Z");

function scan(rows, label) {
  let inversions = 0, ties = 0, tieSelf = 0, tieCross = 0;
  let self = 0, cross = 0, sub100 = 0, sub100Inv = 0, sub100Tie = 0;
  let sub100Self = 0, sub100Cross = 0, sub100InvSelf = 0, sub100InvCross = 0;
  let sub100TieSelf = 0, sub100TieCross = 0;
  const tieList = [], invList = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    const d = b[1] - a[1];
    const same = a[2] === b[2];
    if (same) self++; else cross++;
    if (d < 0) {
      inversions++;
      invList.push([a[0], b[0], d]);
      if (same) { /* counted below */ }
    }
    if (d === 0) {
      ties++;
      if (same) tieSelf++; else tieCross++;
      tieList.push([a[0], b[0], same ? "self" : "cross"]);
    }
    if (Math.abs(d) < 100) {
      sub100++;
      if (same) sub100Self++; else sub100Cross++;
      if (d < 0) { sub100Inv++; if (same) sub100InvSelf++; else sub100InvCross++; }
      if (d === 0) { sub100Tie++; if (same) sub100TieSelf++; else sub100TieCross++; }
    }
  }
  return {
    label, rows: rows.length, pairs: rows.length - 1,
    first: rows[0], last: rows[rows.length - 1],
    inversions, ties, tie_self: tieSelf, tie_cross: tieCross,
    self, cross,
    sub100, sub100_inversions: sub100Inv, sub100_ties: sub100Tie,
    sub100_self: sub100Self, sub100_cross: sub100Cross,
    sub100_inv_self: sub100InvSelf, sub100_inv_cross: sub100InvCross,
    sub100_tie_self: sub100TieSelf, sub100_tie_cross: sub100TieCross,
    inversion_examples: invList.slice(0, 4),
    tie_examples: tieList.slice(0, 40),
  };
}

const postPre = posts.filter(r => r[1] < BOUNDARY);
const postPost = posts.filter(r => r[1] >= BOUNDARY);
const out = {
  boundary: "2026-09-16T08:57:57Z",
  posts: {
    total: scan(posts, "all"),
    pre: scan(postPre, "pre"),
    post: scan(postPost, "post"),
  },
  recent_comments: scan(recent, "recent"),
  pre_comments: scan(pre, "pre"),
};
fs.writeFileSync(new URL("summary.json", here), JSON.stringify(out, null, 1));
const brief = (o) => ({
  rows: o.rows, pairs: o.pairs, inversions: o.inversions, ties: o.ties,
  sub100: o.sub100, sub100_inversions: o.sub100_inversions, sub100_ties: o.sub100_ties,
  tie_self: o.tie_self, tie_cross: o.tie_cross,
});
console.log(JSON.stringify({
  boundary: out.boundary,
  posts_pre: brief(out.posts.pre),
  posts_post: brief(out.posts.post),
  comments_recent: brief(out.recent_comments),
  comments_pre_window: brief(out.pre_comments),
  post_ties: out.posts.post.tie_examples,
  recent_ties: out.recent_comments.tie_examples,
}, null, 1));
