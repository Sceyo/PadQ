# PADQ V1 Persona Acceptance Matrix

**Assessment date:** August 20, 2026  
**Candidate:** `v1.0.0-rc.6`  
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
| A. 25-player arrival on 4 courts | **Pass after adapting to 3 courts** | V1 accepts up to 30 names in one batch. A focused regression proves that the first 12 of 25 registrations fill Courts 1–3 in order and players 13–25 remain in exact registration order. Four courts are rejected by the release configuration and Firestore rules. Registration order is an initial FIFO guarantee; completed-match rotation intentionally changes later order. Existing 30-player browser stress coverage checks the larger supported roster. |
| B. Player verifies position and estimated wait | **Partial** | Live Watch shows all three court assignments, the next four players, their positions, and the number of additional waiting players without refreshing. It does not show every waiting player's exact position or an estimated time. PADQ does not measure match duration, so a time estimate would be unreliable. V1 marketing may promise **next players and live court status**, not estimated wait time. |
| C. Middle-of-queue departure | **Pass** | Manage Queue removes a selected waiting player, and the new regression proves the relative order of every remaining player is unchanged. Sit Out is also available when the host wants to preserve the player in the event roster. |

## 2. Tournament organizer — competitive ladder

| Scenario | Status | V1 evidence and decision |
|---|---|---|
| A. Duo wins four matches and steps off after three | **Partial / deferred for doubles** | Individual streaks update from live history, and Smart Suggestions flags a streak at three wins. Singles mode enforces a three-win forced rotation. Default doubles rotates teams after each result and does not implement a tournament-specific “duo stays until three wins” rule. Tournament and ladder rules remain sealed. |
| B. Opponent-weighted rank promotion | **Partial** | Wins, losses, games played, current streak, win rate, and Bronze–Diamond display tiers recalculate from history. The tier is a simple win-rate threshold after three games; it does not account for opponent strength and is not a competitive rating. PADQ must not market it as Elo, DUPR, or an opponent-adjusted ladder rank. |
| C. Courts 1, 3, and 6 finish simultaneously | **Pass after adapting to Courts 1–3** | The Firestore transaction test now submits all three supported court results concurrently while 30 viewers listen. It requires revision 3, three immutable history entries, all 30 players accounted for exactly once, and no double-booking. Court 6 is outside V1. |

## 3. Senior software engineer — integrity and resilience

| Scenario | Status | V1 evidence and decision |
|---|---|---|
| A. Bad Wi-Fi during a result | **Pass for safety; partial for offline-first behavior** | The UI displays Saving/Connecting state and blocks duplicate submission. A failed authoritative match result restores the previous court and queue, reports the failure, and allows a manual retry after reconnection. Point updates can converge through the Firebase client after a temporary interruption. PADQ does not promise a durable offline match-result outbox or automatic background replay. |
| B. Two concurrent administrators | **Deferred** | V1 has one anonymous owner. Firestore rejects writes from another device/account, so a second volunteer cannot double-assign a team—but they also cannot co-manage the room. Multi-host and delegated scorekeeper access are explicitly sealed for a later version. |
| C. 300 simultaneous Live Watch clients under 500 ms | **Outside V1** | The tested and advertised ceiling is 30 viewers. With 150 results and 30 operational changes, 300 session listeners alone are estimated at about 55,200 Firestore document reads, already beyond the 50,000 daily Spark allowance before optional history reads. V1 has no sub-500 ms service-level guarantee. |

## 4. CEO — onboarding, compliance, and sharing

| Scenario | Status | V1 evidence and decision |
|---|---|---|
| A. Create a venue with 4 courts | **Outside V1** | V1 creates temporary event rooms rather than persistent venues and supports at most three courts. Responsive browser tests cover mobile, tablet, and desktop room setup, but a no-training usability claim still requires observation during the supervised event. |
| B. GDPR privacy and deletion | **Partial** | The public Privacy & Data Retention page explains event data, anonymous authentication, local saved data, free-tier limits, and deletion. Hosts can delete the complete event/history; a browser user can delete locally saved roster and career data. V1 has no permanent player accounts, so there is no individual cloud profile or automated data-subject request workflow. Legal GDPR compliance has not been certified and must not be claimed without legal review. |
| C. Share rank/streak to social media | **Deferred** | Hosts can share the live room through the native share sheet, QR code, or copied watch link. PADQ does not generate or share a player-stat card. Manual screenshots work, but a dedicated viral stats-sharing flow is not part of V1. |

## Automated evidence

- `tests/v1ScenarioMatrix.test.ts`: 25-player/3-court FIFO registration,
  middle departure, 1–3 court/5–30 player rotation, locked partners, stale
  duplicate results, viewer capacity, and room isolation.
- `tests/firestore.rules.test.ts`: three concurrent court completions delivered
  to 30 viewers with atomic revisions and no duplicate player assignment.
- `tests/e2e/gate2-capacity.pw.ts`: 30 real browser viewers receive a three-court
  update without refreshing.
- `tests/e2e/v1-persona-acceptance.pw.ts`: 25-player rush registration order,
  three-court initialization, mobile Live Watch queue summary, and removal of a
  middle waiting player without reordering or reappearing.
- `tests/e2e/public-release-hardening.pw.ts`: offline result rollback/retry,
  privacy deletion, owner event deletion, and viewer access removal.
- `tests/e2e/score-resilience.pw.ts`: rapid score updates, reconnect convergence,
  duplicate-submit protection, score correction, and refresh persistence.
- `tests/playerUtils.test.ts` and `tests/singleEngine.test.ts`: streak, rank-tier,
  hot-streak, and three-win singles rotation rules.

## V1 release decision from this matrix

These scenarios do not introduce a new V1 production blocker **provided the
public claims remain within the sealed contract**. The final supervised real
pickleball event must still validate human usability, phone readability,
roster changes, viewer reconnection, and free-tier usage. The following must not
be advertised for V1: four or more courts, estimated wait time, opponent-weighted
ratings, multiple hosts, durable offline result replay, 300 viewers, persistent
venues, certified GDPR compliance, or stat-card social sharing.
