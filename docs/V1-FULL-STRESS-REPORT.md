# PADQ V1 Full-Feature Stress Report

**Date:** August 3, 2026  
**Branch:** `v1-prod-hardening`  
**Candidate:** `v1.0.0-rc2` (`677343441bb983c84a63c0b58d4f83dd685afade`)  
**Result:** Passed; ready for the controlled Gate 5 launch after the branch and tag are pushed.

## Supported V1 scenarios exercised

- 30 players rotating across three doubles courts with locked partners.
- All 15 possible partner pairs and 150 staggered court rotations.
- 30 players rotating across three singles courts for 150 results without a
  lost or duplicated player.
- 30 simultaneous isolated viewer profiles receiving court changes live.
- Viewer switching among Court 1, Court 2, and Court 3 without refreshing.
- Two rooms operating concurrently as capacity headroom.
- Near-simultaneous court results, duplicate actions, and atomic history writes.
- Single-court custom point scoring, live viewer scores, result history,
  performance, and statistics.
- Late-player entry, queue management, sit-out, return, substitution, court
  unavailability, and undo.
- Host refresh, viewer refresh, temporary offline operation, reconnection,
  mobile, tablet, desktop, and invalid-room recovery.
- V1 scope enforcement for deferred modes and unsupported database fields.

## Defects found and corrected

1. Multi-court singles previously saved the court, queue, and history in
   competing writes. It now uses the same atomic result transaction as doubles.
2. The Custom score control accepted targets that Firestore rejected. Rules now
   accept the UI-supported range of 2 through 100.
3. Rapid host edits and scored-match writes could race on the room revision.
   Host writes are now serialized in the order initiated.
4. A temporary cache-miss snapshot could be mistaken for an expired room.
   Expiration is now shown only after the server confirms the room is absent.
5. Undo in a singles room could persist a doubles engine snapshot. Undo now
   restores only the active game's engine, and rules reject mixed engine data.

## Final verification

| Check | Result |
|---|---:|
| Application unit, component, simulation, and invariant tests | 166 passed |
| Firestore rules and concurrency scenarios | 19 passed |
| Browser end-to-end scenarios | 7 passed |
| Production build and TypeScript | Passed |
| ESLint | 0 errors; 27 existing/deferred warnings |
| Diff whitespace validation | Passed |
| Firebase rules dry run against `padq-ccb6a` | Compiled successfully; not deployed |

The browser and rules suites used only the local Firebase Authentication and
Firestore emulators. They did not consume production Spark reads or writes. The
rules dry run compiled against the production project but did not deploy or
change production data.

The two WebChannel transport messages emitted during the complete browser run
were expected from the test that intentionally disconnects and reconnects a
viewer. The reconnection and resumed live-update assertions passed.

## Release-candidate decision

`v1.0.0-rc1` is superseded because stress testing produced application and
rules fixes. Gate 5 must use `v1.0.0-rc2` exactly. Any later application or
Firestore-rules change requires rerunning Gate 4 verification and creating a
new candidate.
