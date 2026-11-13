# PADQ V1 Gate 4 Release-Candidate Verification

> **Historical record — superseded.** This document describes the earlier RC2
> decision and must not be used to approve the current public release. Scoring
> persistence defects and additional public-release blockers were found after
> RC2. The authoritative release state is now
> [`V1-PUBLIC-RELEASE-TASKS.md`](./V1-PUBLIC-RELEASE-TASKS.md), which requires a
> monitored Firebase App Check rollout before enforcement and final release.

**Branch:** `v1-prod-hardening`

**Date:** 2026-08-03

**Status:** Complete — approved for the controlled Gate 5 launch.

## Automated verification

| Check | Result |
|---|---|
| Application unit, simulation, and component tests | 166 passed |
| Firestore Emulator rules and concurrency tests | 19 passed |
| Browser end-to-end scenarios | 7 passed |
| TypeScript and production build | Passed |
| ESLint | 0 errors; 27 tracked warnings in deferred/existing code |
| Diff whitespace validation | Passed |

The browser suite covers three-court doubles and singles, the host/viewer
journey, 30 simultaneous viewer contexts, custom single-court live scoring,
statistics, history, late-player management, sit-out/return, undo, V1 scope
sealing, mobile and tablet layouts, a delayed initial document load, offline
state retention, reconnection to live updates, refresh, and invalid-room
recovery. Full evidence is recorded in
[`V1-FULL-STRESS-REPORT.md`](./V1-FULL-STRESS-REPORT.md).

All Firebase browser and rules tests use `firebase.e2e.json`, Authentication on
port 9199, and Firestore on port 8180. They do not access production data or
consume Spark quota.

## Environment review

- All six required Firebase web variables are present locally. Their values
  were not printed or recorded.
- The production build succeeds with the candidate environment.
- Emulator variables are not set in the normal local environment.
- The six required Firebase variables were visually confirmed in Vercel with
  non-empty masked values and availability in all environments, including
  Production. No values were exposed or recorded.

Required Vercel Production variable names:

1. `NEXT_PUBLIC_FIREBASE_API_KEY`
2. `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
3. `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
4. `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
5. `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
6. `NEXT_PUBLIC_FIREBASE_APP_ID`

## Firebase Authentication confirmation

The Firebase CLI is authenticated as the expected project account and the
active project is `padq-ccb6a`. Firebase Console screenshots confirmed:

- Authentication → Sign-in method: **Anonymous** is enabled.
- Authentication → Settings → Authorized domains includes `pad-q.vercel.app`,
  along with the project's default Firebase domains and localhost.

## V1 App Check decision

**Decision: launch V1 with App Check disabled and Firestore enforcement off.**

`NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED` is not set, so the application safely
defaults to disabled. This avoids blocking valid players before production
traffic has been monitored. App Check can be enabled in a later controlled
rollout after every production hostname and reCAPTCHA Enterprise site key are
registered and valid/invalid request metrics have been observed.

## Candidate and rollback record

- Approved release-candidate commit:
  `677343441bb983c84a63c0b58d4f83dd685afade`
- Approved candidate tag: `v1.0.0-rc2`
- Rollback commit:
  `caf728d9095231647fe0a3e9f37e6e0bd2169b2d`

`v1.0.0-rc1` is superseded by `v1.0.0-rc2` after full-feature stress testing
found and corrected multi-court singles, score synchronization, cache-startup,
rapid-write, and undo-state defects.

Gate 5 must deploy the exact approved candidate or tag. Later application-code
commits require Gate 4 verification again.
