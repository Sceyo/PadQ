# PADQ V1 Release Gates

**Release branch:** `v1-prod-hardening`  
**Hosting constraint:** Vercel Hobby (free tier)  
**Backend constraint:** Firebase Spark (free tier)  
**Supported V1 event:** up to 30 players on 3 courts

V1 is ready to launch only when every blocking checkbox below is complete. A
passing build alone is not a release approval.

## Gate 0 — Preserve the full product

**Status: Complete**

- [x] Preserve the full feature set on `codex/all-features-v1-archive`.
- [x] Continue production hardening on `v1-prod-hardening`.
- [x] Do not delete deferred modes while preparing V1.

## Gate 1 — Firebase security and room integrity

**Status: Implementation complete; production deployment pending**

- [x] Use authenticated Firebase clients.
- [x] Bind room ownership to the original host identity.
- [x] Prevent room listing and unauthorized room mutation.
- [x] Use six-character random room codes with collision-safe creation.
- [x] Validate the V1 session schema, player and court limits, timestamps,
      queue state, scores, and atomic match history in Firestore rules.
- [x] Reject deferred modes and fields at the database boundary.
- [x] Pass adversarial Firestore emulator tests and a Firebase rules dry run.
- [ ] Deploy the reviewed Firestore rules to `padq-ccb6a` during the controlled
      release window.
- [ ] Smoke-test host and viewer access against the deployed rules.

## Gate 1.5 — Selective three-court spectator synchronization

**Status: Pending — V1 launch blocker**

PADQ's central V1 promise is that players can see every court, choose the court
they want to follow, see who plays next, see the upcoming court assignment, and
review performance. The current single `liveScore` field does not provide three
independent court scores.

- [ ] Store Court 1, Court 2, and Court 3 live state independently under the
      room, with one document per court.
- [ ] Show a viewer court selector with lightweight summaries for all courts.
- [ ] Subscribe each viewer to only the selected court's live-score document.
- [ ] Unsubscribe from the previous court immediately when switching courts.
- [ ] Keep the shared room listener for the queue, next-player order, and court
      assignments.
- [ ] Store compact performance summaries with the room and load detailed match
      history only when the viewer opens it.
- [ ] Commit a finished score atomically to durable match history and the next
      queue/court assignment.
- [ ] Extend Firestore rules so only the host can update court scores while
      authenticated viewers can read a known room's courts.
- [ ] Add emulator tests for cross-room access, malformed scores, unauthorized
      score updates, court switching, and atomic match completion.
- [ ] Add UI tests for joining a room, choosing each court, switching courts,
      reconnecting, and viewing next-player and performance information.

### Gate 1.5 acceptance criteria

- Three courts can show different matches and scores simultaneously.
- A viewer choosing Court 3 receives Court 3 score changes without receiving
  point-by-point changes from Courts 1 and 2.
- Queue and court-assignment changes still reach every viewer.
- A refresh or brief disconnection restores the correct selected-court state.
- Completing two courts at nearly the same time does not lose a result or assign
  one player to two courts.

## Gate 2 — Free-tier capacity and real-life reliability

**Status: Pending — V1 launch blocker**

- [ ] Stress-test 30 players, 3 courts, and 30 viewer devices/tabs.
- [ ] Verify partner requests keep both players together through waiting,
      assignment, completion, and requeueing.
- [ ] Test simultaneous court completions, rapid score changes, duplicate taps,
      host refresh, viewer reconnect, court switching, late arrivals, sit-outs,
      substitutions, and one unavailable court.
- [ ] Measure Firestore reads, writes, deletes, storage, and transfer rather than
      relying only on functional assertions.
- [ ] Keep a normal full event below 35,000 Firestore reads per day and 10,000
      writes per day, leaving headroom below Spark's hard quotas.
- [ ] Run a two-room concurrency test for headroom; V1 only promises one full
      30-player, 3-court event at a time while it remains on free tiers.
- [ ] Confirm the production build does not introduce unnecessary Vercel
      Functions, server actions, cron jobs, or image transformations.
- [ ] Confirm Firebase remains on Spark and Vercel remains on Hobby after the
      release candidate is deployed.

## Gate 3 — V1 scope seal

**Status: Partially complete**

### Keep in V1

- [x] Default singles and doubles queues.
- [x] Maximum 30 players and 3 courts.
- [x] Room-code and QR spectator access.
- [x] Partner queueing.
- [ ] Selective Court 1–3 live scoring from Gate 1.5.
- [ ] Shared next-player and court-assignment view.
- [ ] Quota-efficient session performance summaries and match history.
- [x] Host-only control and read-only viewers.

### Keep sealed after V1

- [x] Tournament and double-elimination modes.
- [x] Play-All mode.
- [x] Skilled matchmaking mode.
- [x] Viewer PIN setup.
- [x] Legacy independent-court coordinator.
- [x] Permanent user accounts and cross-device host recovery.
- [x] Firebase Storage uploads, Cloud Functions, Cloud Run, scheduled jobs,
      managed Firestore TTL, backups, and other billing-dependent services.
- [x] Cross-room public leaderboards and deep live historical analytics.

## Gate 4 — Release-candidate verification

**Status: Pending**

- [ ] Run unit, simulation, Firestore rules, component, and browser end-to-end
      tests from a clean checkout.
- [ ] Pass TypeScript, lint with no errors, and the production build.
- [ ] Test the production environment variables without exposing their values.
- [ ] Verify Anonymous Authentication and authorized production domains.
- [ ] Decide the App Check launch state explicitly. If enabled, register every
      production hostname, use a quota-conscious token TTL, monitor valid and
      invalid traffic first, and enable enforcement only after verification.
- [ ] Perform mobile, tablet, desktop, slow-network, refresh, and offline/error
      recovery checks.
- [ ] Record the approved commit and rollback commit.

## Gate 5 — Controlled production launch

**Status: Pending**

- [ ] Deploy the approved Firestore rules and indexes.
- [ ] Deploy the exact approved commit to Vercel production.
- [ ] Run a host-to-viewer smoke test for all three courts.
- [ ] Verify queue, partner, court assignment, scoring, history, and performance.
- [ ] Monitor Firebase and Vercel usage during the first live event.
- [ ] Roll back immediately if ownership, score integrity, player assignment, or
      free-tier headroom fails.
- [ ] Mark V1 released only after the first controlled event completes without a
      production-blocking incident.

## Free-tier operating rules

- Do not link a billing account or upgrade Firebase without an explicit decision.
- Do not upgrade Vercel or enable paid/on-demand resources without an explicit
  decision.
- Prefer client-side computation and small real-time documents.
- Never keep listeners open for data that is not visible or currently needed.
- Treat quota exhaustion as downtime: Spark and Hobby cap or pause services
  instead of providing guaranteed paid overflow.
- Vercel Hobby is restricted to personal, non-commercial use; reconsider the
  hosting plan before monetizing PADQ.
