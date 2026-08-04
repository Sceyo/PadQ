# PADQ V1 Release Gates

**Release branch:** `v1-prod-hardening`  
**Hosting constraint:** Vercel Hobby (free tier)  
**Backend constraint:** Firebase Spark (free tier)  
**Supported V1 event:** up to 30 players on 3 courts
**Partner requests:** up to `floor(players / 2)` locked pairs per event

V1 is ready to launch only when every blocking checkbox below is complete. A
passing build alone is not a release approval.

## Gate 0 — Preserve the full product

**Status: Complete**

- [x] Preserve the full feature set on `all-features-archive`.
- [x] Continue production hardening on `v1-prod-hardening`.
- [x] Do not delete deferred modes while preparing V1.

## Gate 1 — Firebase security and room integrity

**Status: Complete**

- [x] Use authenticated Firebase clients.
- [x] Bind room ownership to the original host identity.
- [x] Prevent room listing and unauthorized room mutation.
- [x] Use six-character random room codes with collision-safe creation.
- [x] Validate the V1 session schema, player and court limits, timestamps,
      queue state, scores, and atomic match history in Firestore rules.
- [x] Reject deferred modes and fields at the database boundary.
- [x] Pass adversarial Firestore emulator tests.
- [x] Pass the Firebase CLI rules dry run for the exact final candidate against
      `padq-ccb6a`; compilation completed successfully without deploying.
- [x] Deploy the reviewed Firestore rules to `padq-ccb6a` during the controlled
      release window.
- [x] Smoke-test host and viewer access against the deployed rules.

## Gate 1.5 — Live Court Status spectator view

**Status: Complete**

PADQ's central V1 promise is that players can see who is currently playing on
every court, choose the court they want to focus on, see who plays next, see the
upcoming court assignment, and review performance. Multi-court V1 intentionally
does not synchronize point-by-point scores; the host records only the completed
result so court operations remain practical and Firestore usage stays low.

- [x] Keep Court 1, Court 2, and Court 3 assignments in the shared room state.
- [x] Let the host see all three court cards and record a winner independently
      for each completed court.
- [x] Show a viewer Court 1–3 selector with lightweight summaries for all courts.
- [x] Show the selected court's current players and match status without a
      point-by-point scoreboard.
- [x] Label multi-court host and viewer surfaces **Live Court Status**; reserve
      **Live Score** for the optional single-court scoreboard.
- [x] Keep one shared room listener for court assignments, the queue, and
      next-player order; use a separate opt-in listener for completed results.
- [x] Keep the performance/history listener closed by default; load detailed
      history only when the viewer requests it and calculate performance locally.
- [x] Commit a finished result atomically to durable match history and the next
      queue/court assignment.
- [x] Extend Firestore rules and tests so a player cannot occupy two courts and
      only the host can change assignments; the local rules compiler passes.
- [x] Run the emulator tests for cross-room access, unauthorized assignment updates,
      court switching, concurrent results, and atomic match completion.
- [x] Add component tests for selecting Court 1–3, focused current players, safe
      fallback selection, and next-player group size.
- [x] Add browser tests for joining, reconnecting, and switching courts against
      the local Firestore emulator.

### Gate 1.5 acceptance criteria

- Three courts can show different current matches simultaneously.
- A viewer choosing Court 3 sees Court 3's current players and retains access to
  the shared waiting queue and upcoming assignments.
- Queue and court-assignment changes still reach every viewer.
- A refresh or brief disconnection restores the correct selected-court state.
- Completing two courts at nearly the same time does not lose a result or assign
  one player to two courts.
- No point-by-point multi-court score writes are made to Firestore.

## Gate 2 — Free-tier capacity and real-life reliability

**Status: Complete; production-plan recheck remains in Gate 5**

- [x] Stress-test 30 players, 3 courts, and 30 viewer devices/tabs.
- [x] Verify partner requests keep both players together through waiting,
      assignment, completion, and requeueing.
- [x] Stress-test all 15 possible pairs across 30 players, 3 courts, 150
      staggered court rotations, and live pair edits within a waiting/court group.
- [x] Move partner setup into the active multi-court host controls, cap pairs
      at `floor(players / 2)`, and save the complete configuration in one
      Firestore write.
- [x] Test simultaneous court completions, rapid result actions, duplicate taps,
      host refresh, viewer reconnect, court switching, late arrivals, sit-outs,
      substitutions, and one unavailable court.
- [x] Measure Firestore reads, writes, deletes, storage, and transfer rather than
      relying only on functional assertions.
- [x] Keep a normal full event below 35,000 Firestore reads per day and 10,000
      writes per day, leaving headroom below Spark's hard quotas.
- [x] Run a two-room concurrency test for headroom; V1 only promises one full
      30-player, 3-court event at a time while it remains on free tiers.
- [x] Confirm the production build does not introduce unnecessary Vercel
      Functions, server actions, cron jobs, or image transformations.
- [x] Confirm the current Firebase project is on Spark and the current Vercel
      project is on Hobby. Reconfirm both after the release candidate is deployed
      as part of Gate 5.

Detailed measurements and operating limits are recorded in
[`GATE2-CAPACITY-REPORT.md`](./GATE2-CAPACITY-REPORT.md).

## Gate 3 — V1 scope seal

**Status: Complete**

### Keep in V1

- [x] Default singles and doubles queues.
- [x] Maximum 30 players and 3 courts.
- [x] Room-code and QR spectator access.
- [x] Partner queueing.
- [x] Selective Court 1–3 current-match viewing from Gate 1.5.
- [x] Shared next-player and court-assignment view.
- [x] Quota-efficient opt-in performance and match history.
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
- [x] Point-by-point scoring for multi-court sessions.
- [x] Delegated scorekeeper access from separate devices.
- [x] Multi-host sessions and shared session management; planned first for V1.1
      as one owner plus up to two authenticated co-hosts.

### Gate 3 verification

- [x] Confirm injected URL parameters cannot enable tournament, Play-All,
      skilled mode, PIN setup, extra courts, or other deferred controls.
- [x] Confirm the user guide and README distinguish single-court scoring from
      multi-court Live Court Status.
- [x] Serve the static PADQ logo without consuming Vercel image transformations.
- [x] Record the included and deferred boundaries in
      [`V1-SCOPE-SEAL.md`](./V1-SCOPE-SEAL.md).

## Gate 4 — Release-candidate verification

**Status: Complete**

- [x] Run unit, simulation, Firestore rules, component, and browser end-to-end
      tests from a clean checkout.
- [x] Pass TypeScript, lint with no errors, and the production build.
- [x] Test the production environment variables without exposing their values.
- [x] Verify Anonymous Authentication and authorized production domains.
- [x] Decide the App Check launch state explicitly. V1 launches with App Check
      disabled and Firestore enforcement off. If enabled later, register every
      production hostname, use a quota-conscious token TTL, monitor valid and
      invalid traffic first, and enable enforcement only after verification.
- [x] Perform mobile, tablet, desktop, slow-network, refresh, and offline/error
      recovery checks.
- [x] Record the approved commit and rollback commit.

Detailed evidence and the approved candidate/rollback record are recorded
in [`GATE4-RELEASE-CANDIDATE.md`](./GATE4-RELEASE-CANDIDATE.md). The expanded
all-feature and real-life scenario results are in
[`V1-FULL-STRESS-REPORT.md`](./V1-FULL-STRESS-REPORT.md).

## Gate 5 — Controlled production launch

**Status: In progress — production smoke test passed; first live event pending**

- [x] Deploy the approved Firestore rules. No composite indexes are required.
- [x] Deploy the approved V1 code to Vercel production through `main` at
      `9c47c93` (RC2 application commit `6773434`).
- [x] Run a host-to-viewer smoke test for all three courts.
- [x] Verify queue, partner, current-court players, next assignment, completed
      results, history, and performance.
- [ ] Monitor Firebase and Vercel usage during the first live event.
- [ ] Roll back immediately if ownership, result integrity, player assignment, or
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
