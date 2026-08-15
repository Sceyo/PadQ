# PADQ V1 Supervised Event Runbook

**Purpose:** provide the final go/no-go procedure for PADQ V1 using real players.
This event starts only after App Check, the release tag, production deployment,
and the production smoke test are complete.

## Release preconditions

- [ ] `V1-PUBLIC-RELEASE-TASKS.md` sections 1–7 are complete.
- [ ] The deployed Vercel commit matches the recorded V1 release-candidate tag.
- [ ] The deployed Firestore rules match the tagged `firestore.rules` file.
- [ ] Firebase still shows the Spark plan and Vercel still shows the Hobby plan.
- [ ] App Check reports normal production host and viewer traffic as verified.
- [ ] The rollback commit and the person authorized to perform rollback are known.
- [ ] One observer is assigned to record incidents instead of operating the queue.

Do not begin the event if any precondition is unresolved.

## Representative event setup

- Up to 30 real players.
- Three courts when the venue permits; do not exceed three.
- At least two locked partner pairs.
- One primary host device.
- At least three viewer devices, with each following a different court.
- A mix of mobile and desktop browsers when available.
- A backup internet connection or hotspot for recovery testing.

## Before players start

- [ ] Record the release tag, deployed commit, date, venue, host, and observer.
- [ ] Capture baseline screenshots of Firebase usage, Vercel usage, and App Check metrics.
- [ ] Confirm the room code can be entered manually; QR scanning is optional.
- [ ] Confirm viewers cannot edit the event.
- [ ] Confirm the host can add and manage players and set the intended partner pairs.
- [ ] Confirm all three court assignments contain unique players.

## Live scenarios

Run these through ordinary play. Do not manufacture failures while a real point is
in progress.

1. Start the room with three live courts and verify each viewer can select Court
   1, Court 2, or Court 3 without refreshing.
2. Confirm player names, waiting queue, next-player information, and performance
   data remain understandable on viewer devices.
3. On one court, intentionally add an incorrect point, remove it, and verify the
   corrected score survives a refresh.
4. Complete results on different courts in close succession and confirm no player
   is assigned to two courts and no result is duplicated or lost.
5. Let at least one locked pair complete a match and verify they remain together
   when they return to the queue.
6. Exercise one realistic roster change: late arrival, sit-out, return, or queue
   reorder.
7. Briefly disconnect one viewer, reconnect it, and confirm it catches up without
   requiring the host to change anything.
8. If it will not disrupt play, briefly disconnect the host before saving a test
   result. Confirm PADQ reports the failure, preserves the previous assignment,
   and permits a successful retry after reconnection.
9. Run enough normal rotations to evaluate fairness and readability; record any
   manual intervention the host needs.
10. At event end, use **End Session & Delete Event Data** and confirm viewers lose
    access and the room cannot be reopened.

## Live monitoring

Record snapshots at the start, midpoint, and end:

| Check | Start | Midpoint | End | Result |
|---|---:|---:|---:|---|
| Firestore reads today |  |  |  |  |
| Firestore writes today |  |  |  |  |
| Firestore deletes today |  |  |  |  |
| App Check verified requests |  |  |  |  |
| App Check invalid/unknown requests |  |  |  |  |
| Vercel errors or limit warnings |  |  |  |  |
| Host reconnects |  |  |  |  |
| Viewer reconnects |  |  |  |  |

Investigate before continuing if daily usage trends toward the current operating
limits recorded in `GATE2-CAPACITY-REPORT.md`—35,000 reads or 10,000 writes—or if
either provider reports a free-tier limit warning.

## Immediate stop and rollback conditions

Stop using PADQ for the event and preserve screenshots/logs if any of these occurs:

- a viewer or non-owner can change session data;
- one player is assigned to more than one court;
- a confirmed result disappears, duplicates, or corrupts another court;
- a corrected score reverts after refresh;
- an offline or failed save changes the queue as if it succeeded;
- legitimate production devices are blocked after App Check enforcement;
- Firestore or Vercel reports quota exhaustion, repeated errors, or unexpected cost;
- the host cannot safely restore the event to a known state.

Availability rollback order:

1. Stop real match updates and record the room code and current assignments.
2. If App Check is blocking legitimate clients, disable Firestore enforcement.
3. If the application deployment caused the fault, restore the recorded rollback
   deployment.
4. Do not weaken Firestore Security Rules to recover availability.
5. Continue the physical event with a manual queue until the incident is reviewed.

## Incident record

| Time | Device/role | Action | Expected | Actual | Severity | Resolved? |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |

Production-blocking severity includes authorization failure, lost/duplicated
results, invalid court assignments, unrecoverable host state, or exhausted free
quota. Cosmetic or wording issues may be scheduled after V1 only if they do not
mislead the host or players.

## Final release decision

PADQ V1 may be marked publicly released only when:

- [ ] every required live scenario above passed;
- [ ] no production-blocking incident remains open;
- [ ] Firebase and Vercel remained within their free-plan operating boundaries;
- [ ] App Check continued accepting legitimate host and viewer traffic;
- [ ] the observer’s incident log and final usage screenshots are saved;
- [ ] the event result is recorded in `V1-PUBLIC-RELEASE-TASKS.md`.

If any box cannot be checked, V1 remains a release candidate and the supervised
event must be repeated after the blocker is corrected and reverified.
