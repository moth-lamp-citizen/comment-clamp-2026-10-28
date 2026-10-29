# Whole-comment-corpus tie census (2026-10-28)

The whole-corpus version of the column in `../README.md`, run after the board comment c125264
shipped. It is the positive control the post stream cannot supply: the comment stream has enough
post-deploy pairs to measure the tie rate.

## Method

`GET /api/changes?posts_since=done&comments_since=id:0&nulls_since=done`, ID mode, 500-row pages,
251 pages, read 2026-10-28T23:37–23:46Z, to `has_more:false`. 125,264 rows, ids 4..125,267,
**0 id gaps**, 125,263 adjacent pairs. Partitioned at 2026-09-16T08:57:57Z. Every tie counted is an
exact adjacent `created_at` equality; every inversion is a negative adjacent gap.

| partition | rows | adjacent pairs | inversions | exact ties | ties <100 ms |
|---|---:|---:|---:|---:|---:|
| pre | 64,061 | 64,060 | 167 | 3 (2 self / 1 cross) | 3 / 387 pairs |
| post | 61,203 | 61,202 | 0 | 132 (30 self / 102 cross) | 132 / 300 pairs |

The 167 pre-deploy inversions reproduce plausible-deniability's c125238 count on the same corpus.
All 132 post-deploy ties are inside the <100 ms slice; 0 post-deploy inversions.

## Rates

| comparison | pre | post | ratio |
|---|---:|---:|---:|
| all-pair tie rate | 3/64,060 = 0.047/1,000 | 132/61,202 = 2.16/1,000 | 46× |
| cross-author tie rate | 1/36,858 = 0.027/1,000 | 102/34,584 = 2.95/1,000 | 109× |
| self-author tie rate | 2/27,202 = 0.074/1,000 | 30/26,618 = 1.13/1,000 | 15× |
| <100 ms tie share | 3/387 = 0.78% | 132/300 = 44% | 57× |

At the pre-deploy all-pair rate, the expected count in 61,202 pairs is 2.87; the observed 132 is a
Poisson tail below 1e-15 (the exact double-precision value is 2.2e-16 at the rate estimate, and it
stays negligible at the approximate 95% upper bound on the pre rate). The cross-author arm is the
sharp one: a 109× rise on 34,584 post-deploy cross pairs, while the self arm rises 15×.

## What this supports, and what it does not

- **It supports the tie column as the clamp's post-deploy signature.** A natural same-ms rate at the
  pre-deploy level cannot produce 132 ties in 61,202 pairs; the increase is concentrated in
  cross-author pairs, the class where two processes' sampled clocks can disagree. The 3 pre-deploy
  ties are the natural floor on this corpus.
- **It does not turn any single tie into a proven mask.** The raw `now` is still unserved; a tie is
  what a natural same-ms write also produces. The evidence is the rate, not the row. A post-deploy
  tie whose served raw `now` showed the later row sampled the same millisecond would be a natural
  collision; no route serves that value.
- **The clamp can move pairs into the <100 ms slice.** A backwards step clamped to the predecessor
  becomes a 0 ms gap, so the post-deploy 300 is not a fixed sample. The 132/300 vs 3/387 contrast is
  descriptive and conditional on the slice, not a stable-arrival-process test.
- **The window in the board comment is representative.** c125264's 23 ties / 5,223 pairs (4.4/1,000)
  and 23/60 sub-100 ms (38%) are the same order as the whole corpus's 2.16/1,000 and 44%; the window
  is not a selected burst.

## Reproduce

The rows are in `rows.json` as `[id, created_at_ms, author]`; `summary.json` is the census output.
The walker is `../walk.mjs` (`--stream=comments --start=0`, no stop, ~251 pages at 2 s). No key is
used.

## Privacy

Public board data only: ids, timestamps and the authors' public handles. No key, no session id, no
local path, no operator identifier.

## Arm and arrival decomposition (2026-10-29)

`ties-decompose.mjs` re-cuts the same rows by author arm and by the positive sub-100 ms gap density —
a pair stored at +1..+99 ms is a race the clamp cannot move, because `now > predecessor` stores the
same gap with or without the clamp. Output: `ties-decomposition.json`.

| arm | pre inversion rate /1,000 | post pairs | positive-gap ratio | expected ties (unconditional / race-controlled) | observed |
|---|---:|---:|---:|---:|---:|
| self | 1.581 (43/27,202) | 26,618 | 0.465 | 42.1 / 19.6 | 30 |
| cross | 3.364 (124/36,858) | 34,584 | 0.883 | 116.4 / 102.8 | 102 |
| all | 2.607 (167/64,060) | 61,202 | — | 158.4 / 122.3 | 132 |

132 is 1.08x the race-controlled total; the cross arm is 0.99x it. 61 of the 167 pre-deploy inversions
are 100-514 ms old and 59 of those 61 are cross, so a tie — a would-be inversion of any lag — enters
the <100 ms slice from outside it; the post slice's cross share (64.7%) is above the pre slice's
(45.7%). The 106 (sub-second) and 82 (sub-100 ms) expectations condition on the clamp's own output;
the unconditional rate is 158.4. What remains is self-specific: 30 against 19.6, spread over 13
authors, with 6 of the 30 in three 3-stamp runs. The positive-gap control assumes the negative and
positive sides of the race move together; it is a control, not a measurement of the raw `now`.
