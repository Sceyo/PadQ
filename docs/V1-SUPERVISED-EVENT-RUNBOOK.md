# PADQ V1 Supervised Event Runbook

**Purpose:** provide the final, measurable go/no-go procedure for PADQ V1 using
real players. The event starts only after the recorded RC6 production checks
have passed and must use a newly created production room.

## Candidate identity

- Application tag: `v1.0.0-rc.6`
- Tagged application commit: `1f0eb6af9cdc3e1f437b7848c6988a5130562a37`
- Post-tag documentation chain: commit
  `d71b7844a9310074313a4ff4704a1f637e3d0a57` began the README-only updates.
- Runtime comparison requirement: immediately before the event, verify every
  file changed from RC6 to deployed `main` is documentation (`*.md`). Application
  code, configuration, dependencies, and Firestore rules must remain identical.
- Production URL: [https://pad-q.vercel.app](https://pad-q.vercel.app)
- Firebase project: `padq-ccb6a`
- Availability rollback: the exact RC6 production deployment, followed by
  disabling Firestore App Check enforcement only if valid clients are blocked.

Do not retag RC6 or use RC4/RC5 for this event.

## Recorded release preconditions

- [x] `V1-PUBLIC-RELEASE-TASKS.md` sections 1–7 are complete.
- [x] RC6 passed 173 application tests, 20 Firestore Emulator tests, and 16
  browser/stress scenarios.
- [x] Protected GitHub CI, production build, lint, and dependency audit passed.
- [x] The current Vercel production deployment completed successfully and is
  runtime-equivalent to RC6.
- [x] The deployed Firestore rules match the RC6 rules.
- [x] Firebase App Check enforcement is on for Cloud Firestore and legitimate
  production traffic was accepted after propagation.
- [x] Firebase is on Spark with billing disabled; Vercel is on Hobby.
- [x] Live `/`, `/privacy`, and `/queue?mode=doubles` smoke checks returned 200
  with the required security headers.

## Event-day preconditions

- [ ] Confirm Firebase still shows Spark and Vercel still shows Hobby.
- [ ] Confirm no billing account, paid add-on, or marketplace service was added.
- [ ] Confirm App Check shows legitimate production requests as verified.
- [ ] Record the host, observer, venue, date, start time, and intended duration.
- [ ] Assign one observer who does not operate the host queue.
- [ ] Prepare a paper/manual queue and a backup internet connection.
- [ ] Record the exact production deployment and rollback deployment.
- [ ] Verify `git diff --name-only v1.0.0-rc.6..main` lists documentation only.
- [ ] Capture baseline Firebase usage, Vercel usage, and App Check screenshots.

Do not begin if any event-day precondition is unresolved.

## Required event profile

- **20–30 real players**.
- **Exactly 3 courts** for the main event.
- **At least 90 minutes** of normal operation.
- **At least 24 confirmed match results**.
- **One host device** and **one independent observer**.
- **At least 6 Live Watch devices**, including mobile, tablet, and desktop when
  available. Each court must be followed by at least one viewer.
- **At least 2 locked partner pairs**.
- At least one late arrival, one middle-of-queue removal, and one sit-out/return.
- One controlled viewer disconnect/reconnect.
- One controlled host-network interruption performed only between real points.

If the venue cannot meet this profile, record the attempt but do not use it to
approve V1. Repeat the gate at a representative event.

## Separate single-court score preflight

Point-by-point scoring is intentionally available only in single-court mode.
Do this immediately before the three-court event in a separate temporary room:

1. Create a new one-court room and enable live scoring.
2. Open the room on at least one Live Watch device.
3. Add a point, intentionally add one incorrect point, and remove it.
4. Refresh both host and viewer and confirm the corrected score persists.
5. Temporarily interrupt the host connection while attempting a result. Confirm
   PADQ reports the failure, preserves the court assignment, blocks duplicate
   submission, and permits one successful retry after reconnection.
6. End the preflight room and confirm it can no longer be opened.

- [ ] Corrected score survived host and viewer refresh.
- [ ] Failed result did not advance or duplicate the match.
- [ ] Manual retry succeeded once within 30 seconds of reconnection.
- [ ] Deleted preflight room became unavailable within 10 seconds.

Any failure is a release blocker. Do not try to test point scoring inside the
three-court room because that is not a V1 feature.

## Main three-court procedure

### Setup and launch

- [ ] Create a fresh doubles room; do not reuse a preflight or earlier RC room.
- [ ] Add the real players and set at least two locked pairs.
- [ ] Start three courts and confirm every on-court player is unique.
- [ ] Confirm the remaining waiting order matches registration order.
- [ ] Go Live and confirm viewers cannot edit the event.
- [ ] Confirm every viewer can switch among Courts 1–3 without refreshing.

### Required live scenarios

1. Run ordinary rotations until at least 24 results are confirmed.
2. Complete results on two or three courts in close succession. Confirm each
   result creates one history entry and no player is double-booked or lost.
3. Double-click or rapidly press one winner control once. Confirm exactly one
   result is saved and the button shows a saving/disabled state.
4. Verify the locked pairs remain together when they return to a legal shared
   assignment. Verify unlocked players do not repeat a partner immediately.
5. Add one late player and record where PADQ places them.
6. Remove one player from the middle of the waiting queue. Confirm the player
   remains in the roster but does not reappear in the waiting queue, and the
   relative order of all other waiting players is unchanged.
7. Sit one player out and return them later. Confirm no active court is
   disrupted and the player re-enters only once.
8. Disconnect one viewer, complete a host action, reconnect the viewer, and
   confirm it catches up without a host-side workaround.
9. Between points, interrupt the host network during a safe non-result update.
   Confirm the connection state is visible and the synchronized state converges
   after reconnection.
10. Ask viewers to identify the court they are following, the current players,
    and the next displayed players without coaching.
11. At the end, capture final usage/App Check evidence before deleting the room.
12. Use **End Session & Delete Event Data**. Confirm every viewer loses access
    and the room cannot be reopened within 10 seconds.

## Observer timing and integrity log

Record every confirmed result or material queue action. Use elapsed seconds from
the host action until the viewer reflects it.

| # | Time | Action/court | Host acknowledged (s) | Viewer updated (s) | Refresh needed? | Correct? | Notes |
|---:|---|---|---:|---:|---|---|---|
| 1 |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |

## Usage monitoring

Record provider values at the start, midpoint, and end. Evaluate the **event
delta**, not only the daily total.

| Check | Start | Midpoint | End | Event delta/result |
|---|---:|---:|---:|---|
| Firestore reads |  |  |  |  |
| Firestore writes |  |  |  |  |
| Firestore deletes |  |  |  |  |
| App Check verified requests |  |  |  |  |
| App Check invalid/unknown requests |  |  |  |  |
| Vercel errors or limit warnings |  |  |  |  |
| Host reconnects |  |  |  |  |
| Viewer reconnects |  |  |  |  |
| Infrastructure cost |  |  |  |  |

Investigate immediately if daily usage approaches the operating limits in
`GATE2-CAPACITY-REPORT.md`—35,000 reads or 10,000 writes—or if either provider
reports a free-tier warning.

## Required release metrics

### A. Integrity — all are hard gates

- [ ] **0** players assigned to more than one court.
- [ ] **0** lost, duplicated, or corrupted confirmed results.
- [ ] History entry count equals confirmed-result count.
- [ ] **100%** of confirmed results survive host and viewer refresh.
- [ ] **0** unintended waiting-order changes after middle removal.
- [ ] **0** removed or sitting-out players automatically assigned.
- [ ] **0** immediate unlocked-partner repeats.
- [ ] **100%** of locked pairs remain together in their legal assignments.
- [ ] **0** successful viewer/non-owner writes.
- [ ] One rapid duplicate action produces exactly one result.

### B. Realtime and recovery — all are hard gates

- [ ] At least **95%** of observed viewer updates appear within **3 seconds**.
- [ ] No observed viewer update takes longer than **10 seconds**.
- [ ] A reconnected viewer catches up within **10 seconds**.
- [ ] At least **95%** of result submissions acknowledge within **3 seconds**.
- [ ] The controlled failed result safely retries within **30 seconds** after
  reconnection and creates exactly one result.
- [ ] **0** correctness-related manual page refreshes.
- [ ] **0** crashes, blank screens, or unrecoverable states lasting over 30 seconds.

### C. Rotation fairness — all are hard gates

- [ ] Among players continuously available for the same measurement window,
  maximum games played minus minimum games played is **2 or less**.
- [ ] Waiting players are selected before newly returned or late players unless
  a locked-pair constraint makes that impossible; every exception is recorded.
- [ ] Middle removal preserves the relative order of every remaining player.
- [ ] At least **90%** of surveyed participants call the rotation fair or
  understandable.

### D. Usability — all are hard gates

- [ ] From a finalized player list to a live three-court room takes **5 minutes
  or less**.
- [ ] Median host time to record a winner is **10 seconds or less**.
- [ ] The host completes the event with **no developer intervention**.
- [ ] At least **80%** of sampled viewers can identify their selected court,
  current players, and next displayed players without coaching.
- [ ] Host confidence rating is **4/5 or higher**.
- [ ] At most **2 cosmetic issues** are recorded, and neither can mislead a host
  about saving, assignment, score, or deletion state.

### E. Free-tier and security — all are hard gates

- [ ] Event delta is at most **15,000 Firestore reads**, **500 writes**, and
  **200 deletes**.
- [ ] App Check accepts **100% of legitimate event devices**; the verified count
  increases during each legitimate smoke flow and no legitimate request is
  categorized as invalid or unknown. Unrelated hostile traffic is recorded but
  does not fail the event unless it affects a legitimate device.
- [ ] **0** Vercel runtime errors or provider quota warnings.
- [ ] Firebase remains Spark, Vercel remains Hobby, and event cost is **$0 / ₱0**.
- [ ] The deleted room becomes inaccessible within **10 seconds**.

## Immediate stop and rollback conditions

Stop PADQ use, switch to the paper queue, and preserve screenshots/logs if:

- a viewer or non-owner changes session data;
- one player appears on two courts;
- a confirmed result disappears, duplicates, or corrupts another court;
- a corrected single-court score reverts after refresh;
- a failed save advances the queue as if it succeeded;
- a removed or sitting-out player is assigned automatically;
- legitimate production devices are blocked by App Check;
- Firestore or Vercel reports quota exhaustion, repeated errors, or cost; or
- the host cannot restore the event to a known safe state.

Rollback order:

1. Stop entering results and record the room code and current assignments.
2. Continue the physical event using the prepared paper queue.
3. If App Check blocks legitimate clients, disable Firestore enforcement.
4. If a deployment caused the fault, restore the recorded exact RC6 deployment.
5. Never weaken Firestore Security Rules to restore availability.
6. Do not resume PADQ during the event until the incident is understood.

## Incident record

| Time | Device/role | Action | Expected | Actual | Severity | Workaround | Resolved? |
|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |

Critical/high severity includes authorization failure, lost or duplicated
results, invalid court assignment, incorrect persistence, unrecoverable host
state, legitimate App Check blocking, quota exhaustion, or unexpected cost.

## Participant and host survey

| Question | Result |
|---|---|
| Participants surveyed / total participants |  |
| Rotation fair or understandable (%) |  |
| Viewers correctly identified court/current/next (%) |  |
| Host confidence (1–5) |  |
| Host needed developer intervention? |  |
| Most confusing moment |  |

## Final release decision

PADQ may drop the RC label only when:

- [ ] every integrity, recovery, fairness, usability, free-tier, and security
  hard gate above passes;
- [ ] no critical or high incident remains open;
- [ ] all event-day evidence and the observer log are saved;
- [ ] no runtime code/configuration/dependency change was made after the tested
  candidate; if one was made, create a new RC, run the full CI/deployment gate,
  and repeat the supervised event;
- [ ] the result is recorded in `V1-PUBLIC-RELEASE-TASKS.md`; and
- [ ] protected CI passes before creating the immutable `v1.0.0` tag and GitHub
  release.

If any box cannot be checked, PADQ remains `v1.0.0-rc.6`. Fix the blocker,
produce a newly verified release candidate when runtime files change, and repeat
the supervised event.
