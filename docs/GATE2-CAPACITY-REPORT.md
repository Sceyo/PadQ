# PADQ V1 Gate 2 Capacity Report

**Test date:** August 3, 2026

**Release branch:** `v1-prod-hardening`

**Target:** Firebase Spark and Vercel Hobby
**V1 load promise:** one active 30-player, 3-court event with up to 30 spectators

## Result

Gate 2's local capacity and real-life reliability checks pass. The release must
still be launched as a free, personal/non-commercial release while it uses
Vercel Hobby. A commercial PADQ launch requires moving to a plan whose terms
permit commercial use.

## Executed scenarios

- 30 players on 3 independently rotating courts for 150 completed matches.
- All 15 possible locked partner pairs across the same 150 rotations.
- Two separate 30-player rooms running 150 interleaved results each.
- 30 authenticated Firestore viewers receiving concurrent Court 1 and Court 2
  completions; both results persisted and all 30 players remained unique.
- 30 isolated Chrome spectator profiles distributed across Courts 1–3; every
  viewer received a queue rotation without refreshing.
- Host refresh and recovery, viewer refresh, selected-court persistence, rapid
  duplicate result taps, late arrivals, sit-outs, substitutions, and one court
  remaining unavailable while the other two continued rotating.
- Firebase's automatic streaming/long-polling detection under spectator load.
  PADQ no longer forces long polling for every viewer.

## Conservative Firebase event estimate

The estimate assumes 150 results, 30 operational changes, 30 viewers, and the
worst case where every viewer opens performance/history. The measured JSON
payloads were 1,414 bytes for the full 30-player room and 230 bytes per result.

| Resource | One full event | Two full rooms | PADQ budget | Spark quota |
|---|---:|---:|---:|---:|
| Document reads | 10,715 | 21,430 | 35,000/day | 50,000/day |
| Document writes | 333 | 666 | 10,000/day | 20,000/day |
| Deletes on explicit cleanup | 151 | 302 | 20,000/day | 20,000/day |
| Raw stored payload before cleanup | 35,914 bytes | 71,828 bytes | under 1 MB/event | 1 GiB |
| Estimated document transfer | 9,608,706 bytes | 19,217,412 bytes | under 100 MB/event | 10 GiB/month |

The transfer estimate excludes protocol and index overhead. Even applying a 4×
safety factor gives approximately 38.4 MB for one full event. History is closed
by default, so normal events should use fewer reads than this worst case.

Firestore's free quota resets daily for reads, writes, and deletes. TTL deletes,
backups, PITR, restore, and clone operations require billing and remain sealed
for V1. Session/history cleanup must therefore be an explicit host operation;
PADQ must not depend on managed TTL while it remains on Spark.

## Vercel assessment

The production build contains no API routes, server actions, cron jobs, image
optimization usage, middleware/proxy, or PADQ backend functions. The only
dynamic route is `/watch/[sessionId]`, used to render a room-specific entry URL;
all real-time event work goes directly from the browser to Firebase.

A 30-viewer event therefore creates only a small number of Vercel page/asset
requests compared with Hobby's current included limits of 1,000,000 function
invocations and 100 GB Fast Data Transfer per month. This technical headroom
does not override Hobby's personal, non-commercial use restriction.

## Official quota references

- Firebase Firestore pricing and free quota: https://firebase.google.com/docs/firestore/pricing
- Firebase Firestore quotas: https://firebase.google.com/docs/firestore/quotas
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Vercel limits: https://vercel.com/docs/limits

## Launch operating limits

- Promise one full 30-player/3-court event at a time for V1.
- Two-room operation is tested as headroom, not marketed as the V1 guarantee.
- Keep detailed history opt-in and closed by default.
- Do not enable point-by-point multi-court scoring in V1.
- Monitor Firebase Usage and Vercel Usage during the first controlled event.
- Stop or roll back if daily usage trends toward 35,000 reads or 10,000 writes.
