# PADQ V1 Public Release Tasks

**Goal:** make PADQ safe and reliable enough for public V1 posting while staying within Firebase Spark and Vercel Hobby limits.

**Release rule:** a task is complete only when its implementation, automated verification, and any required production-console check are recorded. The supervised real pickleball event must remain the final task.

## Status key

- `[ ]` Not started or blocked
- `[-]` In progress
- `[x]` Implemented and verified

## 1. Establish the release register and clean baseline

- [x] Record every public-release blocker and its evidence requirement in this file.
- [x] Separate PADQ release changes from unrelated working-tree files.
- [x] Produce one clean release-candidate commit after all automated work passes.
- [ ] Tag the candidate only after the App Check configuration is ready for production verification.

**Verification:** clean intended diff, exact commit recorded, no unrelated files in the release commit, production dependencies audited.

## 2. Data deletion and privacy controls

- [x] Replace the misleading Hard Reset with an explicit **End Session & Delete Event Data** action.
- [x] Delete Firestore history in bounded batches before deleting the parent session.
- [x] Keep “leave session” separate from permanent deletion.
- [x] Add a separate **Delete Saved Player Data on This Device** control for roster, career stats, and skill data.
- [x] Show clear retention and deletion language before confirmation.

**Verification:** emulator tests prove owner deletion succeeds, non-owner deletion fails, history is removed, and local-data deletion does not silently delete a live event.

## 3. Realtime reliability and QR entry

- [x] Restore the previous host state when a court-result transaction fails.
- [x] Distinguish stale assignment, temporary network failure, and permission failure in the UI.
- [x] Prevent another court result while the previous result is unresolved.
- [x] Default Watch entry to room code and request camera access only after an explicit user action.
- [x] Check QR support before camera permission and fix scanner readiness so detection can run.

**Verification:** browser tests cover stale results, rejected/offline commits, score correction, refresh recovery, explicit camera start, and unsupported QR browsers.

## 4. Public-site security, privacy, and accessibility

- [x] Add CSP, clickjacking protection, `nosniff`, referrer, permissions, and cross-origin headers.
- [x] Add a public Privacy & Data Retention page with Spark/free-tier limitations and support contact.
- [x] Add Privacy access from the homepage and queue/watch interfaces.
- [x] Improve metadata, canonical URL, robots metadata, and social sharing metadata.
- [x] Add semantic homepage heading and accessible modal naming, focus behavior, and icon labels.
- [x] Remove external Google Font requests or explicitly disclose them.

**Verification:** production build, automated accessibility assertions, and live response-header inspection after deployment.

## 5. Firestore rules hardening

- [x] Validate roster and queue contents as far as the Firestore 1,000-expression limit safely permits. Rules enforce limits, uniqueness, queue/court roster membership, and client-side name validation; per-item nested scans are intentionally excluded because they break valid 30-player rooms.
- [x] Enforce locked-partner capacity without reintroducing the 30-player rule-evaluation failure. Only the owner can write; the client enforces pair shape, roster membership, and non-reuse before saving.
- [x] Prevent pre-live session/history reads where the V1 watch contract requires a live room.
- [x] Preserve host ownership, immutable history, no listing, maximum 30 players, and maximum 3 courts.
- [x] Repeat the adversarial rules audit and dry-run compilation.

**Verification:** all rule tests and malicious-payload tests pass in the Firestore emulator, and the rules compile in a Firebase dry run.

## 6. Firebase App Check and free-tier abuse controls

- [ ] Follow the no-billing rollout recorded in `FIREBASE-APP-CHECK-ROLLOUT.md`.
- [ ] Register every production hostname with Firebase App Check using reCAPTCHA Enterprise.
- [ ] Add the App Check site key and enable flag to Vercel production configuration.
- [ ] Deploy in monitoring mode first and confirm valid host/viewer requests.
- [ ] Enforce App Check for Firestore only after monitoring shows legitimate traffic is accepted.
- [ ] Reconfirm Firebase Spark and Vercel Hobby status and document quota response steps.

**Verification:** Firebase App Check metrics show verified production traffic, invalid test traffic is rejected after enforcement, and normal host/viewer flows still pass.

## 7. Reproducible release candidate and deployment verification

- [x] Run lint, unit/scenario tests, Firestore rules tests, full browser stress tests, production build, and production dependency audit.
- [x] Verify 30 players, 3 courts, locked partners, score correction, 30 viewers, reconnect, history, and deletion.
- [ ] Create and push a clean `v1.0.0-rc3` or later tag from the verified commit.
- [ ] Deploy exactly that commit to Vercel and deploy exactly its Firestore rules.
- [ ] Recheck live security headers, App Check, mobile behavior, and Firebase/Vercel usage.

**Verification:** all automated checks pass against the exact tagged code and the production smoke test matches it.

## 8. Final task — supervised real pickleball event

- [ ] Run one supervised real event using representative players and up to three courts.
- [ ] Monitor Firestore reads/writes, Vercel usage, reconnects, score corrections, queue fairness, and viewer updates during the event.
- [ ] Record incidents and roll back if ownership, assignment integrity, persistence, or free-tier headroom fails.
- [ ] Mark V1 publicly released only after the event completes without a production-blocking incident.

This task intentionally remains last because automated and console verification must be complete before real players depend on PADQ.

## Verification log

### 2026-08-15 — local public-hardening pass

- Verified release-candidate code commit: `f7e8e8d9e00782836a42dc85d65378f0fcd8ea35` on `codex/v1-public-rc`; unrelated local documents were excluded.
- Production build: passed with Next.js 16.3.1.
- Lint: passed with no errors.
- Unit/scenario suite: 171 passed; 20 intentionally skipped emulator-only cases.
- Firestore rules emulator suite: 20/20 passed, including 30 players, 3 courts, 15 locked pairs, concurrency, ownership, pre-live privacy, and deletion authorization.
- Public-release browser suite: 5/5 passed, covering QR consent, device-data deletion, event/history deletion, offline match rollback, reconnect, and response headers.
- Firebase project dry run: `padq-ccb6a` rules compiled successfully; no deployment was performed.
- Production dependency audit: 0 known vulnerabilities reported.
- Full browser/stress suite against the recorded candidate: 15/15 passed in 1.7 minutes, including 30 simultaneous viewer tabs.
