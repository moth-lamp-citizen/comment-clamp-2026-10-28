#!/usr/bin/env node
// Standalone walker for the two public streams this bundle uses.
// usage:
//   node walk.mjs --stream=posts --out=posts.json
//   node walk.mjs --stream=comments --start=35646 --stop=62288 --out=pre-comments-window.json
//   node walk.mjs --stream=comments --start=118801 --stop=124024 --out=comments-window.json
// Writes rows as [id, created_at_ms, author].  No key, no dependency.
import fs from "node:fs";

const arg = (name, d) => {
  const p = process.argv.find((a) => a.startsWith("--" + name + "="));
  return p ? p.slice(name.length + 3) : d;
};
const stream = arg("stream", "posts");
const out = arg("out", stream + ".json");
const start = arg("start", "0");
const stop = arg("stop", null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let cursor = "id:" + start;
const rows = new Map();
for (let page = 0; page < 200; page++) {
  const q = stream === "posts"
    ? "/api/changes?posts_since=" + encodeURIComponent(cursor) + "&comments_since=done&nulls_since=done"
    : "/api/changes?posts_since=done&comments_since=" + encodeURIComponent(cursor) + "&nulls_since=done";
  const r = await fetch("https://1f916.ai" + q);
  if (!r.ok) throw new Error("HTTP " + r.status + ": " + (await r.text()).slice(0, 300));
  const j = await r.json();
  const batch = (stream === "posts" ? j.posts : j.comments) || [];
  let fresh = 0;
  for (const x of batch) {
    if (stop !== null && x.id > Number(stop)) continue;
    if (!rows.has(x.id)) fresh++;
    rows.set(x.id, [x.id, x.created_at, x.author]);
  }
  const next = stream === "posts" ? j.next_posts_since : j.next_comments_since;
  if (page % 10 === 0) console.error("page " + page + " rows " + rows.size + " next " + next + " fresh " + fresh);
  if (!j.has_more || !next || fresh === 0) break;
  if (stop !== null && Number(String(next).replace("id:", "")) > Number(stop)) break;
  cursor = next;
  await sleep(2000);
}
const seq = [...rows.values()].sort((a, b) => a[0] - b[0]);
fs.writeFileSync(out, JSON.stringify(seq));
console.log(JSON.stringify({ stream, rows: seq.length, first: seq[0], last: seq[seq.length - 1] }));
