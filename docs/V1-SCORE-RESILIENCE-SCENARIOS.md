# PADQ V1 Score and Realtime Resilience Scenarios

These scenarios cover the production risks found during personal testing. The automated cases run against Firebase Auth and Firestore emulators; the field cases should be repeated on the deployed Vercel URL with two real devices.

## Automated release scenarios

| ID | Scenario | Expected result |
|---|---|---|
| SR-01 | Reach the winning score accidentally, then subtract one point | Match is not committed; minus remains usable; viewer receives the correction |
| SR-02 | Refresh the host at a non-zero score | Score, point limit, labels, and deuce state are restored |
| SR-03 | Reach deuce in a custom game to 3 | At 2-2 the target becomes 4; winning requires a two-point margin |
| SR-04 | Refresh while the game is at deuce | Both score and temporary target survive reload |
| SR-05 | Enter 11 points rapidly | Viewer converges to the latest score without refreshing and no host write fails |
| SR-06 | Temporarily disconnect the host, score locally, then reconnect | Pending score reaches Firebase and the viewer automatically catches up |
| SR-07 | Correct and confirm a doubles score | Corrected winner/score is reviewed before the outer match confirmation |
| SR-08 | Double-activate winner confirmation and doubles match confirmation | Exactly one history entry is created and the old score is cleared for the next pairing |
| SR-09 | Resume a room before its first match, when no engine state has been written yet | Queue engine reconstructs from persisted players without blank-player writes or extra Rules cost at creation |
| SR-10 | Create 30-player, three-court room | Creation remains inside Firestore Rules evaluation and Spark-plan capacity model |

## Manual deployed-device scenarios

| ID | Setup | Actions | Pass condition |
|---|---|---|---|
| FD-01 | Host laptop + viewer phone on Wi-Fi | Score 10-5, refresh host, score 11, subtract to 10 | Both devices show 10-5 without refreshing viewer |
| FD-02 | Same devices | Score five points about one second apart | Viewer follows within a reasonable live delay and ends on the exact host score |
| FD-03 | Host on mobile hotspot | Disable hotspot, add one point, restore hotspot | Viewer catches up automatically; no score disappears |
| FD-04 | Singles game at 10-10 | Score to 12-10 | PADQ accepts 12-10 as the winning score, not 13-10 |
| FD-05 | Doubles game | Misclick winning point, subtract, re-add, confirm score, confirm match | One match appears in history with corrected score and winner |
| FD-06 | Completed match | Refresh host and viewer | History remains; next pairing has a fresh 0-0 score |
| FD-07 | Three courts and at least 13 players | Complete Court 2 while viewer follows Court 2 | Court assignment changes live and other courts remain unchanged |
| FD-08 | 30-player, three-court room | Complete one result on each court in quick succession | No duplicate player appears on two courts and all three results persist |
| FD-09 | Host and viewer | Leave viewer backgrounded for two minutes, then reopen it | Viewer reconnects to the current court and score without manual reload |
| FD-10 | Host | Double-click a result/confirmation button | Only one history result is recorded |

## V1 release decision

All automated scenarios must pass. FD-01 through FD-06 are mandatory before redeploying Gate 5; FD-07 through FD-10 are the recommended first live-session checklist.

## Audit results — 2026-08-13

The audit found and corrected the following underlying defects:

- The deuce target increased by two, incorrectly requiring a three-point margin.
- Saving an unused empty doubles-engine payload during room creation could exceed Firestore Rules' 1,000-expression evaluation limit.
- Two near-simultaneous doubles confirmations could advance the queue twice.
- Winner confirmation also needed an immediate one-shot lock before React could replace the completed match.

The score-resilience suite, established V1 browser suite, Firestore Rules suite, unit tests, lint, and production build passed after correction.
