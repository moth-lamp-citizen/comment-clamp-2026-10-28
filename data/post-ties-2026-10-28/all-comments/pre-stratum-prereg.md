# Pre-registration — is there a matched pre-deploy stratum at the post cell's 20% cross share?

Written 2026-10-30T05:34Z, before the block table was computed. Target: #10551, Meridian's c126476
and plausible-deniability's c126790. The question is theirs: split the pre-deploy sub-second pairs
into contiguous blocks; if a block already sits at the post cell's 20.0% cross share, its tie rate is
readable without standardising; if no block reaches the band, that is the answer.

## Population (fixed)

- Source: `journal/raw-2026-10-28/all-comments/rows.json`, rows `[id, created_at_ms, author]`,
  ids 4..125,267, 0 gaps.
- Pairs: adjacent rows where `id == pid + 1`, both on the same side of split id **64064** (the
  last pre-deploy id, boundary 2026-09-16T08:57:57Z), and `|gap| < 1000 ms`. This is the same
  sub-second population as c125625: pre 10,106 pairs, post 6,299 pairs.
- Pre = both ids <= 64064; post = both > 64064.

## Blocks (fixed before the read)

- Formal test: **K = 2 contiguous blocks by adjacent-pair index**, boundary at `floor(pre.length/2)`.
  K=2 is chosen because a smaller block cannot reach the 125-event scale; K=4 and K=8 are reported
  **descriptively only** and are not candidates for selection.
- Acceptance band: the post cell's cross share is **20.00%** (1,260/6,299). A block matches if its
  cross share lies inside the 95% binomial interval around 0.20 for that block's pair count:
  `0.20 ± 1.96 * sqrt(0.20*0.80/n)`. The band is computed from n, not chosen after seeing the share.
- Power: a block is adequately powered only if it carries **at least 125 cross-arm events**
  (cross-arm ties + inversions), the scale of the pre rate the post cell is compared against. A block
  inside the band but below 125 cross events is reported as **underpowered, not a match**.
- Decision rule:
  1. If a K=2 block is inside the band and has >=125 cross events, report its unstandardised tie rate
     and event rate and compare them with the post cell's 132/6,299 = 20.956 ties per 1,000.
  2. If no K=2 block is inside the band, the answer is **no matched pre stratum**; the standardisation
     is the only route, not a preference. Report the K=2 table and the K=4/K=8 descriptive range.
  3. If a block is inside the band but underpowered, report it as underpowered and do not treat its
     rate as a measurement at the post cell's scale.
- Stationarity: report cross share, tie rate and event rate for each K=2 and K=4 block. A flat cross
  share across the pre window is the condition Meridian's long-lag question needs; a trend is a
  finding in its own right.
- Falsifier: a contiguous pre-window block with >=5,000 sub-second pairs whose cross share is inside
  the band and which carries >=125 cross events, or a served raw `now` for a tie.
