# PADQ V1 Gate 4 Release-Candidate Verification

**Branch:** `v1-prod-hardening`

**Date:** 2026-08-03

**Status:** In progress — local candidate verification passed; production
console confirmation remains.

## Automated verification

| Check | Result |
|---|---|
| Application unit, simulation, and component tests | 164 passed |
| Firestore Emulator rules and concurrency tests | 17 passed |
| Browser end-to-end scenarios | 5 passed |
| TypeScript and production build | Passed |
| ESLint | 0 errors; 28 tracked warnings in deferred/existing code |
| Diff whitespace validation | Passed |

The browser suite covers the three-court host/viewer journey, 30 simultaneous
viewer contexts, V1 scope sealing, mobile and tablet layouts, a delayed initial
document load, offline state retention, reconnection to live updates, refresh,
and invalid-room recovery.

All Firebase browser and rules tests use `firebase.e2e.json`, Authentication on
port 9199, and Firestore on port 8180. They do not access production data or
consume Spark quota.

## Environment review

- All six required Firebase web variables are present locally. Their values
  were not printed or recorded.
- The production build succeeds with the candidate environment.
- Emulator variables are not set in the normal local environment.
- The repository is not linked to a local Vercel project, so the six variable
  names must still be confirmed in Vercel Production settings before Gate 4 is
  closed.

Required Vercel Production variable names:

1. `NEXT_PUBLIC_FIREBASE_API_KEY`
2. `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
3. `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
4. `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
5. `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
6. `NEXT_PUBLIC_FIREBASE_APP_ID`

## Firebase Authentication confirmation

The Firebase CLI is authenticated as the expected project account and the
active project is `padq-ccb6a`. The Firebase Console could not be inspected
from the controlled browser because access is disabled by its saved privacy
preference.

Before approving the release candidate, manually confirm:

- Firebase Console → Authentication → Sign-in method: **Anonymous** is enabled.
- Firebase Console → Authentication → Settings → Authorized domains includes
  the production Vercel hostname, currently `pad-q.vercel.app`, plus every
  custom production hostname that will serve PADQ.

## V1 App Check decision

**Decision: launch V1 with App Check disabled and Firestore enforcement off.**

`NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED` is not set, so the application safely
defaults to disabled. This avoids blocking valid players before production
traffic has been monitored. App Check can be enabled in a later controlled
rollout after every production hostname and reCAPTCHA Enterprise site key are
registered and valid/invalid request metrics have been observed.

## Candidate and rollback record

The release-candidate commit and its immediate rollback commit will be recorded
after the remaining Firebase and Vercel production-console checks are confirmed.
Gate 5 must deploy that exact approved candidate; later commits require Gate 4
verification again.
