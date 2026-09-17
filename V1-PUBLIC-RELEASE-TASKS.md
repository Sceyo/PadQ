# PADQ V1 Public Release Tasks

**Goal:** make PADQ safe and reliable enough for public V1 posting while staying within Firebase Spark and Vercel Hobby limits.

**Release rule:** a task is complete only when its implementation, automated verification, and any required production-console check are recorded. The supervised real pickleball event must remain the final task.

**Hard cost boundary:** V1 must remain at **₱0 / $0** infrastructure spend. Do not attach a billing account, upgrade Firebase to Blaze, upgrade Vercel from Hobby, or enable a paid add-on. Reaching a free quota must pause or degrade the service rather than create a charge.

## Status key

- `[ ]` Not started or blocked
- `[-]` In progress
- `[x]` Implemented and verified

## 1. Establish the release register and clean baseline

- [x] Record every public-release blocker and its evidence requirement in this file.
- [x] Separate PADQ release changes from unrelated working-tree files.
- [x] Produce one clean release-candidate commit after all automated work passes.
- [x] Tag the candidate only after the App Check configuration is ready for production verification.

**Verification:** clean intended diff, exact commit recorded, no unrelated files in the release commit, production dependencies audited.

## 1.5. Public GitHub release governance

- [x] Record PADQ as proprietary software under an All Rights Reserved notice, with Francis Aliser as the copyright holder.
- [x] Configure the repository Git author name as `Francis Aliser` so the final V1 tag does not use the placeholder `Your Name` identity.
- [x] Add `SECURITY.md` and enable GitHub private vulnerability reporting before directing users to report security issues. Verified enabled through GitHub's repository API on 2026-08-17.
- [x] Protect `main` with active GitHub ruleset `20927157`, which blocks deletion and force pushes, requires a pull request and the strict `verify` status check, and preserves linear history. Verified on 2026-08-17 with zero required approvals and no bypass actor.
- [x] Open the release pull request from `v1-public-rc` to `main`, confirm its quality gate passes, and merge only the approved candidate. PR [#1](https://github.com/Sceyo/PadQ/pull/1) merged the public candidate; PRs [#2](https://github.com/Sceyo/PadQ/pull/2), [#3](https://github.com/Sceyo/PadQ/pull/3), and [#4](https://github.com/Sceyo/PadQ/pull/4) carried the reviewed identity, partner-rotation, and queue-removal corrections into RC6.

**Verification:** GitHub's repository API reports private vulnerability reporting enabled and `main` protected; the merged commit matches the approved release tag and has a successful quality-gate run.

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

- [x] Follow the no-billing rollout recorded in `FIREBASE-APP-CHECK-ROLLOUT.md`.
- [x] Register every production hostname with Firebase App Check using reCAPTCHA Enterprise.
- [x] Add the App Check site key and enable flag to Vercel production configuration.
- [x] Deploy in monitoring mode first and confirm valid host/viewer requests.
- [x] Enforce App Check for Firestore only after monitoring shows legitimate traffic is accepted.
- [x] Reconfirm Firebase Spark and Vercel Hobby status and document quota response steps.
- [x] Confirm no billing account, paid Vercel plan, or paid marketplace/add-on has been attached before deployment. Firebase remains on Spark with billing disabled, and Vercel remains on Hobby.

**Verification:** Firebase App Check metrics show verified production traffic, invalid test traffic is rejected after enforcement, and normal host/viewer flows still pass.

## 7. Reproducible release candidate and deployment verification

- [x] Run lint, unit/scenario tests, Firestore rules tests, full browser stress tests, production build, and production dependency audit.
- [x] Verify 30 players, 3 courts, locked partners, score correction, 30 viewers, reconnect, history, and deletion.
- [x] Repeat the complete quality gate in GitHub Actions on a clean Ubuntu/Node 22 runner.
- [x] Create and push a clean `v1.0.0-rc.6` tag from verified post-merge application commit `1f0eb6af9cdc3e1f437b7848c6988a5130562a37`. RC6 includes the multi-court partner-rotation correction and the authoritative queue-removal correction found during the 2026-08-20 supervised preflight; RC4 and RC5 must not be used for the final event.
- [x] Deploy the exact RC6 application commit to Vercel and confirm its Firestore rules are the deployed rules. Post-tag `main` documentation commits begin at `d71b7844a9310074313a4ff4704a1f637e3d0a57`; they change only Markdown records, so their automatic Vercel deployments are runtime-equivalent to RC6.
- [x] Recheck live security headers, App Check, mobile behavior, and Firebase/Vercel usage.

**Verification:** all automated checks pass against the exact tagged code and the production smoke test matches it.

## 8. Final task — open public testing validation gate

**Decision & context:** The original V1 release plan specified a single, tightly controlled in-person event as the final release gate. To validate PADQ under genuine real-world conditions with diverse devices, network qualities, and user habits, the final validation gate is satisfied by **opening PADQ to public testers**. This trades a small, artificially monitored headcount for unmonitored real-world adoption.

### Risk profile & operational controls for open testing:

1. **Free-tier exposure (Firebase Spark & Vercel Hobby):**
   - *Risk:* Open public traffic lacks an artificial ceiling on concurrent sessions or traffic. Uncontrolled spikes could approach Spark quotas (50,000 reads/day, 20,000 writes/day) or Vercel Hobby bandwidth.
   - *Control & monitoring:* Check Firebase Console usage and Vercel dashboards daily during the first week of public availability.
   - *Manual kill switch:* If usage approaches free-tier headroom (>80% of daily quota), the host entry point can be paused by updating `V1_RELEASE` or deploying a static maintenance notice, preserving the strict $0 / ₱0 cost boundary.
   - *Session limits:* Sessions remain bounded at 30 players, 3 courts, and auto-lock after 30 minutes of inactivity to prevent abandoned session accumulation.

2. **Absence of dedicated in-person observer:**
   - *Risk:* No dedicated observer stands beside hosts to catch operational friction, UI confusion, or edge cases.
   - *Control & reporting channel:* Testers are directed to report bugs and feedback directly via the public [PADQ GitHub Issue Tracker](https://github.com/Sceyo/PadQ/issues), linked from the Privacy & Data Retention page and README.
   - *Security reporting:* Private vulnerability reporting is actively enabled under GitHub ruleset `20927157`.

3. **Host safety nets & error recovery:**
   - In an open testing environment without developer supervision, self-serve recovery mechanisms are critical:
     - **Multi-court Undo:** Accidental win taps on any court are immediately reversible via **Undo Last Match** in Settings, fully restoring court slots, queue order, and removing the recorded history document.
     - **Corrupted Storage Warning:** If client storage is damaged or invalid, an amber banner prompts the host to re-enter players rather than silently misbehaving.
     - **Score-Limit Confirmation:** Points past the score limit can be walked down with the minus button; `onWin` fires only upon deliberate button confirmation.
     - **Inactive Session Recovery:** Heartbeat updates un-stale idle sessions, preventing permanent lockout.

### Open testing release preconditions:
- [x] Multi-court undo gap resolved and verified against Firebase emulators.
- [x] `isSessionActive` Firestore rule lockout resolved with heartbeat-only bypass and negative test coverage.
- [x] Working tree cleaned and superseded reports clearly marked.
- [x] Local quality gates clean (`tsc`, `lint`, `vitest`, rules emulator suite).
- [ ] Open PADQ publicly to initial cohort of real pickleball hosts and players.
- [ ] Monitor first 72 hours of open testing for reported issues, crash reports, and quota headroom.
- [ ] Mark V1 officially released once open testing confirms stability without blocking incidents.

## Verification log

### 2026-08-15 — local public-hardening pass

- Verified release-candidate code commit: `f7e8e8d9e00782836a42dc85d65378f0fcd8ea35` on `v1-public-rc`; unrelated local documents were excluded.
- Production build: passed with Next.js 16.3.1.
- Lint: passed with no errors.
- Unit/scenario suite: 171 passed; 20 intentionally skipped emulator-only cases.
- Firestore rules emulator suite: 20/20 passed, including 30 players, 3 courts, 15 locked pairs, concurrency, ownership, pre-live privacy, and deletion authorization.
- Public-release browser suite: 5/5 passed, covering QR consent, device-data deletion, event/history deletion, offline match rollback, reconnect, and response headers.
- Firebase project dry run: `padq-ccb6a` rules compiled successfully; no deployment was performed.
- Production dependency audit: 0 known vulnerabilities reported.
- Full browser/stress suite against the recorded candidate: 15/15 passed in 1.7 minutes, including 30 simultaneous viewer tabs.
- Remote clean-run verification: GitHub Actions **V1 quality gate** run [#1](https://github.com/Sceyo/PadQ/actions/runs/31889805963) passed every stage for commit `bda088dce0e1e709d97b85ba20c792a78b15e36b` on Ubuntu/Node 22.

### 2026-08-15 — historical production gap confirmation (resolved by RC4–RC6)

- `https://pad-q.vercel.app/` responded successfully but did not include the candidate's CSP, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` headers.
- `https://pad-q.vercel.app/privacy` returned 404 and the homepage did not expose the candidate's Privacy link.
- Therefore the current Vercel production deployment is an older build and cannot satisfy the V1 public-release checklist. Do not reuse the prior RC2 smoke-test result as evidence for the current candidate.

### 2026-08-15 — App Check registration prepared

- Firebase App Check shows `padq-web` registered with reCAPTCHA Enterprise for the production hostname.
- Vercel shows both App Check variables saved with **Production** scope; Preview and Development remain excluded.
- The accidental Vercel redeployment used old `main` commit `eb6235183133eafff5b0c400a6a07110547cb9b0`, which is the direct ancestor of the candidate. It did not deploy the release candidate, privacy page, or security headers and requires no rollback.
- Firestore enforcement remains intentionally off until the tagged candidate produces verified production traffic.
- Annotated tag `v1.0.0-rc.3` was pushed and resolves to commit `e112c8612d471e55d633d93d019d4a8e39aae00c`.

### 2026-08-20 — supervised preflight partner-rotation incident

- A 10-player, two-court doubles run showed ordinary teams such as `9 & 10`, `5 & 6`, and `7 & 8` remaining together in consecutive assignments even though they were not locked pairs.
- Root cause: the multi-court FIFO rotation appended each finished court as Team A followed by Team B. The next four-player selection therefore rebuilt one of the previous adjacent teams; the winning side was recorded in history but did not affect this ordering.
- Fix candidate `1.0.0-rc.5` interleaves the two finished teams before returning them to the shared queue. Explicitly locked pairs are reconstructed and intentionally remain together.
- The host label and user guide now say **Partners rotate unless locked** so fixed-pair behavior is not mistaken for a rotation failure.
- Regression coverage runs 10 players across 2 courts for 40 results and rejects any immediately repeated unlocked partner. The complete local gate passed with 172 unit/scenario tests, 20 Firestore rules tests, 15 browser/stress scenarios, lint, and a production build.
- The supervised event remains incomplete and must restart in a new room after RC6 reaches production.

### 2026-08-20 — persona acceptance preflight queue-removal incident

- A 25-player, three-court browser scenario showed that **Manage Queue** appeared
  to remove a middle waiting player but then displayed that player at the end of
  the waiting list.
- Root cause: the synchronized queue removed the player correctly, but a host UI
  fallback treated every roster player missing from the queue as an optimistic
  startup omission and appended them to the displayed waiting list.
- RC6 makes the synchronized queue authoritative. A player removed from the
  queue remains available in the event roster but is no longer waiting or
  eligible for automatic court assignment.
- Focused unit and browser coverage verifies 25-player registration order, the
  removal, unchanged relative order for the other 12 waiting players, and the
  Live Watch count changing from 13 to 12 waiting players.
- The same acceptance pass strengthens the Firestore concurrency case from two
  simultaneous court completions to all three supported courts with 30 viewers,
  three revisions, three history entries, and no double-booked player.

### 2026-08-20 — RC6 pre-event production verification

- PR [#4](https://github.com/Sceyo/PadQ/pull/4) merged through protected
  `main` after the required `verify` workflow passed. Annotated tag
  `v1.0.0-rc.6` resolves to application commit
  `1f0eb6af9cdc3e1f437b7848c6988a5130562a37`.
- RC6 passed 173 unit/scenario/component tests, 20 Firestore Emulator tests,
  16 browser/stress scenarios, a production build, lint with zero errors, and
  the production dependency audit with zero reported vulnerabilities.
- The exact RC6 commit reached Vercel production successfully. The production
  deployment recorded during this audit used later documentation commit
  `d71b7844a9310074313a4ff4704a1f637e3d0a57`; its only change from RC6 was
  `README.md`. Any later pre-event deployment must repeat the documented diff
  check and contain Markdown changes only, keeping application code,
  configuration, dependencies, and Firestore rules identical to RC6.
- The RC6 Firestore rules are unchanged from the previously deployed hardened
  rules. The Firebase deploy reported the latest rules already up to date and
  released them successfully for project `padq-ccb6a`.
- Firebase App Check monitoring showed legitimate production traffic accepted
  before Cloud Firestore enforcement was enabled. After propagation, the
  recorded Cloud Firestore metrics showed 83 verified requests allowed and 5
  invalid/unknown requests denied. Replay protection remains off for V1.
- Live smoke checks returned HTTP 200 for `/`, `/privacy`, and
  `/queue?mode=doubles`. Each response included Content Security Policy,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and Permissions Policy.
- Firebase remains on Spark with billing disabled, and Vercel remains on Hobby.
  The zero-spend boundary is unchanged.
- PR [#5](https://github.com/Sceyo/PadQ/pull/5) refreshed the public README and
  passed the same protected quality gate. No runtime file changed after RC6.
- **Sections 1–7 are complete. The supervised real pickleball event in section
  8 is the only remaining V1 release gate.**

### 2026-09-11 — multi-court undo visibility fix

- `canUndo` in `app/queue/page.tsx` excluded multi-court sessions (`courtSlots.length === 0`) even though `handleUndoLastMatch` already supported restoring `courtSlots`. A mis-tapped court result was previously unrecoverable through the UI in the primary 3-court mode.
- Fixed by removing the multi-court exclusion from `canUndo`.
- Added `tests/scoreCorrection.test.tsx`, covering the related score-limit-overshoot correction path in `ScoreBoard` (minus button works past the score limit; match only concludes on explicit confirm).
- Manually verified Undo restores a court correctly after a mis-tapped result in multi-court mode with the Firebase emulators running (automated via Playwright in `tests/e2e/live-court-status.pw.ts`).

### 2026-09-12 — deep working tree audit & autoClose resolution

- Resolved `autoClose` default in `app/queue/page.tsx`: explicitly reverted from `true` back to `false`. Modal auto-dismissal is opt-in via the modal checkbox to ensure hosts always have deliberate review time before dismissing a match result.
- Performed deep review across state management & sync, multi-court flows, Firestore rules, test suite assertions, and release documentation. All write methods, listener cleanups, multi-court correction paths, and rules constraints verified clean.

### 2026-09-13 — session lockout fix, repo hygiene & open-testing readiness

- Fixed `isSessionActive` Firestore rule lockout: separated heartbeat updates from substantive updates using `isHeartbeatUpdate`. Stale sessions (>30m inactive) can now successfully recover via host heartbeat writes (`updatedAt`/`lastActiveAt` only) while substantive state modifications remain gated until refreshed.
- Enhanced client heartbeat in `hooks/useSession.ts`: added `visibilitychange` and window `focus` event listeners to immediately fire `touchSession()` on tab refocus, circumventing browser background-tab timer throttling.
- Added comprehensive unit test coverage in `tests/firestore.rules.test.ts` proving: (1) 35m-stale sessions reject substantive writes, (2) heartbeat-only writes succeed, (3) subsequent substantive writes immediately succeed once un-staled. Verified with deliberate negative-path failure check.
- Resolved stray repository files: restored tracked zip archives on disk, added superseded banner to `PRODUCTION_READINESS_AND_DEPLOYMENT_REPORT.md` pointing to current release tasks, and classified `output/` observer packet as a build export.
- Rewrote Section 8 to formally adopt **Open Public Testing** as the final release validation gate in place of the single supervised in-person event, documenting free-tier monitoring, kill switch controls, issue tracker channels, and host safety nets. Section 8 remains open pending public tester deployment.

### 2026-09-14 — emulator verification, Firebase/Vercel readiness & resilience pass

#### Step 1 — Actual test output (emulators running)

**`npm run test:rules`** — Firestore emulator, 2026-09-14 16:58 PHT:

```
 Test Files  1 passed (1)
       Tests  21 passed (21)
    Start at  16:58:16
    Duration  10.09s
Script exited successfully (code 0)
```

**`npm run test:e2e`** — auth + firestore emulators, first run: **16 passed / 1 failed**. Test 3 (`multi-court mode reveals Undo Last Match…`) timed out: after clicking the Team A win button, the `WinnerModal` remained open (`autoClose` defaults to `false`) and its `modal-overlay` intercepted the subsequent Settings gear click. This was a **test bug, not a product bug**. Fix: added a dismiss step (wait for `.modal-overlay` visible → Escape → wait for overlay gone) before the Settings click in `tests/e2e/live-court-status.pw.ts:115–121`. Escape-to-close was already wired in `WinnerModal.tsx`.

**`npm run test:e2e`** — second run after fix, 2026-09-14:

```
Running 17 tests using 1 worker

  ok  1 gate2-capacity.pw.ts         › 30 viewer tabs receive a three-court queue rotation (37.3s)
  ok  2 live-court-status.pw.ts      › host and viewer share three live courts (4.9s)
  ok  3 live-court-status.pw.ts      › multi-court mode reveals Undo Last Match… (2.5s)  ← previously failing
  ok  4 public-release-hardening     › watch defaults to room code, camera on consent (1.3s)
  ok  5 public-release-hardening     › device-data deletion preserves room reference (1.0s)
  ok  6 public-release-hardening     › owner permanently deletes event and history (5.5s)
  ok  7 public-release-hardening     › offline match save restores queue, retryable (1.8s)
  ok  8 public-release-hardening     › responses include public-release security headers (103ms)
  ok  9 release-candidate.pw.ts      › responsive viewers and offline reconnection (7.1s)
  ok 10 release-candidate.pw.ts      › invalid room recovery usable on mobile (1.5s)
  ok 11 score-resilience.pw.ts       › deuce win-by-two, survives reload, correctable (6.1s)
  ok 12 score-resilience.pw.ts       › rapid points + network loss converge without refresh (6.6s)
  ok 13 score-resilience.pw.ts       › doubles score correction requires review, commits once (4.7s)
  ok 14 v1-feature-stress.pw.ts      › 30-player three-court singles rotates safely (4.5s)
  ok 15 v1-feature-stress.pw.ts      › single-court scoring, management, stats, history, undo (8.4s)
  ok 16 v1-persona-acceptance.pw.ts  › 25-player rush preserves order, handles departure (3.6s)
  ok 17 v1-scope-seal.pw.ts          › deferred features sealed against URL params (1.2s)

  17 passed (1.7m)
  Script exited successfully (code 0)
```

**`npm run build`** (after adding `app/error.tsx` and `app/not-found.tsx`):

```
▲ Next.js 16.3.1 (Turbopack)
✓ Compiled successfully in 7.2s  |  TypeScript: 0 errors
✓ Generating static pages (6/6)
Exit code: 0
```

#### Step 2 — Firebase readiness

| Check | Result | Method |
|---|---|---|
| Active project | `padq-ccb6a` confirmed current | `firebase projects:list` |
| `firestore.rules` compilability | ✅ Compiled, dry run complete | `firebase deploy --only firestore:rules --dry-run` (exit 0) |

**Manual Firebase Console checks required** (agent cannot log into the console):

- **Billing:** confirm `padq-ccb6a` is on Spark (free). Blaze = hard release blocker.
- **Budget alerts:** Spark has no billing budget alerts (billing account required). Accepted gap — no action possible.
- **App Check:** confirm Firestore shows "Enforced". Confirm reCAPTCHA site key in console matches `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` in Vercel Production env vars.
- **Auth providers:** confirm only Anonymous auth is enabled. Verify no accidental OAuth providers.
- **Rules parity:** confirm production-deployed rules match local `firestore.rules`. Dry-run verifies compilability only, not production parity.
- **Indexes:** confirm all composite indexes are "Active" (not "Building").
- **TTL policy:** confirm no Firestore TTL is deployed. Session expiry is application-enforced (30m, `isSessionExpired`).

#### Step 3 — Vercel readiness

**Live security headers — actual response from `https://pad-q.vercel.app`, 2026-09-14:**

```
Content-Security-Policy:      default-src 'self'; script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com; [… full policy per next.config.ts]
Cross-Origin-Opener-Policy:   same-origin-allow-popups
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy:           camera=(self), microphone=(), geolocation=(), browsing-topics=()
Referrer-Policy:              strict-origin-when-cross-origin
Strict-Transport-Security:    max-age=63072000; includeSubDomains; preload  (Vercel-provided)
X-Content-Type-Options:       nosniff
X-Frame-Options:              DENY
X-Vercel-Cache:               HIT
```

All 7 application-level headers from `next.config.ts` confirmed live. HSTS is Vercel-provided with 2-year max-age and preload.

**Env var keys** (from `.env.example` — values never logged; confirmed scoping per 2026-08-15 entry):

All 11 vars are `NEXT_PUBLIC_*`. App Check vars are Production-scoped only. Emulator vars are dev-only.

**Manual Vercel dashboard checks required:**

- Confirm all 8 non-emulator env vars have **Production** scope.
- Confirm latest production deployment is a Markdown-only commit after RC6 (`1f0eb6af9cdc3e1f437b7848c6988a5130562a37`).
- Confirm plan is **Hobby** with no paid add-ons.
- Preview deployments: confirm `X-Robots-Tag: noindex` is present (Vercel default for preview URLs).

#### Step 4 — Resilience

**`app/error.tsx` (NEW):** Next.js App Router error boundary added. Uses `retry` prop (stable in v16.3.0). Logs `error.digest` for server-side correlation. Inline styles — renders even if stylesheets fail. Build verified (exit 0).

**`app/not-found.tsx` (NEW):** 404 page added. PADQ-contextual copy for viewers navigating dead session links. Inline styles. Build verified (exit 0).

**`isReconnecting` UI banner — VERIFIED:** `session.isReconnecting` renders a visible `<div class="session-alert session-alert--reconnecting"><Wifi /> Reconnecting…</div>` in both host (line 1548) and join/viewer paths (line 1646) of `page.tsx`. CSS class defined in both `QueueSystem.css` and `CSS/match.css`. Not a silent stall.

**Slow-network code path (Slow 3G — code path traced, cannot execute programmatically):** Under Slow 3G, Firestore `onSnapshot` long-polling may take 5–15s. Host sees loading state, no court data. Match writes may time out and surface the offline-rollback amber banner. All paths have E2E coverage in `score-resilience.pw.ts` (test 12).

**Cross-browser smoke test — user action required:** Must be performed on real devices: **iOS Safari** and **Android Chrome**. Items to confirm: (1) WinnerModal dismisses on overlay tap, (2) QR camera permission prompt appears only on first explicit scan tap, (3) "Connected" in session bar appears within 10s, (4) Undo Last Match appears in Settings after a match finishes on a real 3-court session. Agent cannot perform this test.

