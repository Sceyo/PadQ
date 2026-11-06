# PADQ V1 Persona Acceptance Matrix

**Assessment date:** November 6, 2026  
**Candidate:** `v1.0.0` (`UI-Overhaul`)  
**V1 contract:** up to 30 players, 3 courts, one host, and 30 simultaneous viewers on Firebase Spark and Vercel Hobby.

This matrix evaluates the host, organizer, engineering, and product scenarios
against the sealed V1 contract. A scenario outside that contract is not treated
as a V1 failure, but PADQ must not advertise it as available.

## Status definitions

- **Pass:** implemented and covered by automated evidence within V1 limits.
- **Partial:** some requested behavior exists, but the full claim is not supported.
- **Deferred:** intentionally sealed for a later release.
- **Outside V1:** exceeds the published free-tier operating boundary.

## 1. Pickleball host — Saturday morning rush

| Scenario | Status | V1 evidence and decision |
|---|---|---|
| A. 25-player arrival on 4 courts | **Pass after adapting to 3 courts** | V1 accepts up to 30 names in one batch (including Smart Reclub/numbered list paste and Two-Tier Pre-Session Check-In). A focused regression proves that the first 12 of 25 registrations fill Courts 1–3 in order and players 13–25 remain in exact registration order. Four courts are rejected by the release configuration and Firestore rules. Registration order is an initial FIFO guarantee; completed-match rotation intentionally changes later order. Existing 30-player browser stress coverage checks the larger supported roster. |
| B. Player verifies position and estimated wait | **Pass (deterministic ETA & Turn Alerts)** | Live Watch displays all three court assignments, the full waiting queue with exact positions (`#1`, `#2`, …), deterministic wait-time badges (`Next Up`, `~10m`, `~20m` via `etaEngine.ts`), and **Tap-Your-Name Turn Alerts** (Web Audio chime + vibration when advancing to On Deck or On Court). |
| C. Middle-of-queue departure | **Pass** | Manage Queue removes a selected waiting player, and the regression proves the relative order of every remaining player is unchanged. Sit Out is also available when the host wants to preserve the player in the event roster (supporting both Priority Return to front and Return to back). |

## 2. Tournament organizer — competitive ladder

| Scenario | Status | V1 evidence and decision |
|---|---|---|
| A. Duo wins four matches and steps off after three | **Pass for singles; partial / deferred for doubles** | Individual streaks update from live history, and Smart Suggestions flags a streak at three wins. Both single-court and multi-court singles enforce a three-win forced rotation (`SINGLES_MAX_WIN_STREAK = 3` / `MULTI_COURT_SINGLES_MAX_STREAK = 3`). Default doubles rotates teams after each result and does not implement a tournament-specific “duo stays until three wins” rule. Tournament and ladder rules remain sealed. |
| B. Opponent-weighted rank promotion | **Pass for 4-tier tiebreakers; partial for Elo/DUPR** | Standings rank players deterministically across 4 tiers: **Wins → Win % → Point Differential (`+/-`) → Opponent Win % (Matchup Strength / OWP)**. Bronze–Diamond display badges summarize session win rate and are not marketed as external Elo or DUPR ratings. |
| C. Courts 1, 3, and 6 finish simultaneously | **Pass after adapting to Courts 1–3** | The Firestore transaction test submits all three supported court results concurrently while 30 viewers listen. It requires revision 3, three immutable history entries, all 30 players accounted for exactly once, and no double-booking. Court 6 is outside V1. |

## 3. Senior software engineer — integrity and resilience

| Scenario | Status | V1 evidence and decision |
|---|---|---|
| A. Bad Wi-Fi during a result | **Pass for safety; partial for offline-first behavior** | The UI displays Saving/Connecting state and blocks duplicate submission. A failed authoritative match result restores the previous court and queue, reports the failure, and allows a manual retry after reconnection. Point updates converge through the Firebase client after a temporary interruption. PADQ does not promise a durable offline match-result outbox or automatic background replay. |
| B. Two concurrent administrators | **Deferred** | V1 has one anonymous owner. Firestore rejects writes from another device/account, so a second volunteer cannot double-assign a team—but they also cannot co-manage the room. Multi-host and delegated scorekeeper access are explicitly sealed for a later version. |
| C. 300 simultaneous Live Watch clients under 500 ms | **Outside V1** | The tested and advertised ceiling is 30 viewers. With 150 results and 30 operational changes, 300 session listeners alone are estimated at about 55,200 Firestore document reads, already beyond the 50,000 daily Spark allowance before optional history reads. V1 has no sub-500 ms service-level guarantee. |

## 4. CEO — onboarding, compliance, and sharing

| Scenario | Status | V1 evidence and decision |
|---|---|---|
| A. Create a venue with 4 courts | **Outside V1** | V1 creates temporary event rooms rather than persistent venues and supports at most three courts. Responsive browser tests cover mobile (`390px` with `>= 44px` touch targets), tablet, and desktop room setup. |
| B. GDPR privacy and deletion | **Partial** | The public Privacy & Data Retention page explains event data, anonymous authentication, local saved data, free-tier limits, and deletion. Hosts can delete the complete event/history; a browser user can delete locally saved roster and career data. V1 has no permanent player accounts, so there is no individual cloud profile or automated data-subject request workflow. Legal GDPR compliance has not been certified and must not be claimed without legal review. |
| C. Share rank/streak to social media | **Pass** | Hosts and spectators can generate and share both **Session Standings** and **Individual Player Spotlight** stat cards via `RecapModal` (supporting native Web Share API, clipboard copy, and PNG image download), in addition to sharing the live room via QR code or watch link. |

## Automated evidence

- `tests/v1ScenarioMatrix.test.ts`: 25-player/3-court FIFO registration,
  middle departure, 1–3 court/5–30 player rotation, locked partners, stale
  duplicate results, viewer capacity, and room isolation.
- `tests/firestore.rules.test.ts`: 39 emulator security and concurrency tests,
  including three concurrent court completions delivered to 30 viewers with
  atomic revisions and no duplicate player assignment.
- `tests/e2e/gate2-capacity.pw.ts`: 30 real browser viewers receive a three-court
  update without refreshing.
- `tests/e2e/v1-persona-acceptance.pw.ts`: 25-player rush registration order,
  three-court initialization, compact display names (`formatDisplayName`),
  mobile Live Watch queue summary, and removal of a middle waiting player
  without reordering or reappearing.
- `tests/e2e/live-wiring-regressions.pw.ts` & `tests/e2e/mobile-touch-targets.pw.ts`:
  Smart paste, pre-session check-in, 1-tap late arrivals, multi-court singles
  3-win streak rotation, retroactive Flip Winner sync, spectator turn alerts,
  and 390px mobile `>= 44px` touch target verification.
- `tests/e2e/public-release-hardening.pw.ts`: offline result rollback/retry,
  privacy deletion, owner event deletion, and viewer access removal.
- `tests/e2e/score-resilience.pw.ts`: rapid score updates, reconnect convergence,
  duplicate-submit protection, score correction, and refresh persistence.
- `tests/playerUtils.test.ts`, `tests/singleEngine.test.ts`, `tests/multiCourtResult.test.ts`, and `tests/nameFormatter.test.ts`:
  4-tier tiebreakers, streak, rank-tier, three-win singles rotation rules, and compact name formatting.

## V1 release decision from this matrix

These scenarios do not introduce a V1 production blocker **provided the
public claims remain within the sealed contract**. The following must not
be advertised for V1: four or more courts, external Elo/DUPR ratings,
multiple hosts, durable offline result replay, 300 viewers, persistent
venues, or certified GDPR compliance.
