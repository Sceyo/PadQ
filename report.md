# PadQ System Report

**Date**: 2026-05-09 (updated — Phase 3 club-scale features implemented)
**Branch**: Testing
**Scope**: Full codebase audit — queue algorithms, architecture, security, UX, data layer; club-scale use case assessment (5 courts, 50+ players)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Resolved Issues](#resolved-issues)
3. [What Is Needed (Critical)](#what-is-needed-critical)
4. [What Could Be Improved](#what-could-be-improved)
5. [Suggestions](#suggestions)
6. [Club-Scale Readiness](#club-scale-readiness)
7. [Priority Table](#priority-table)

---

## System Overview

PadQ is a real-time match queue manager for singles and doubles paddle/racket sports. A host creates a session, adds players, and the app manages fair player rotation across four queue modes (Default, Tournament, Play-All, Randomize). Viewers join via a 4-character room code on a separate read-only watch page.

**Stack**: Next.js 16.2.1 · React 19 · Firebase Firestore · TypeScript 5
**Session TTL**: 30 minutes (Firestore auto-delete on `lastActiveAt`)
**Queue modes**: Default, Tournament, Play-All, Randomize
**Game modes**: Singles (king-of-court), Doubles (INIT → WINNERS → LOSERS cycle)

**Current scale fit**: Well-suited for 1 court with 8–16 players. Ready for 5+ courts and 50+ players — club-scale roster and coordinator overlay are now implemented.

---

## Resolved Issues

These were flagged as critical in the original audit and have since been fixed.

---

### ~~1. Engine State Was Not Persisted~~ — RESOLVED

`doublesEngineState` and `singlesEngineState` are now serialized to Firestore on every `commitMatchResult` call and rehydrated into `paddleStateRef` / `singlesStateRef` when the host resumes. `playedThisCycle` is converted from `Set<string>` to `string[]` for storage and back on load. `page.tsx` runs a one-time rehydration effect gated by `engineRehydratedRef` to prevent repeated overwrites from Firestore snapshots.

---

### ~~2. No Periodic Session Heartbeat~~ — RESOLVED

`useSession` now runs a `setInterval` every 5 minutes that calls `touchSession` while `isHost` is true. The interval is cancelled in the effect cleanup. This prevents the 30-minute TTL from deleting an active session during a long match or break.

---

### ~~3. Firestore Security Rules Were Not Enforced Server-Side~~ — RESOLVED

`firestore.rules` now enforces `hostToken` server-side for all updates and deletes on both the session document and the history subcollection. Reads and creates remain open to support room-code joining and new session creation.

---

### ~~4. Play-All Mode Bypassed the Paddle Engine~~ — RESOLVED

`handleDoublesMatch` in `page.tsx` previously gated `advancePaddleState` behind `activeQueueMode === 'default'`. The condition has been changed to `gameMode === 'doubles'` so the paddle engine runs after every doubles match regardless of queue mode. `recordPlayAllDoubles` still fires in play-all mode alongside the engine — both run in parallel. The `enginePatch` serialization in `addHistory` was updated to always persist doubles engine state for doubles games, not only in default mode.

---

### ~~5. Odd Player Counts Broke Doubles INIT~~ — RESOLVED

`advancePaddleState` in `doublesEngine.ts` used `Math.ceil(allPlayers.length / 4)` to compute the number of INIT matches, scheduling a padded second match for 5–7 players that forced early players to play twice. Changed to `Math.max(1, Math.floor(allPlayers.length / 4))` so only complete groups of 4 are scheduled. Remainder players (those that don't fill a full group) flow into `waitingQueue` via the existing overflow path at INIT transition and are promoted to `w1` as unplayed players at the start of the WINNERS phase.

---

### ~~6. Multi-Court Heartbeat Only Covered the Active Court~~ — RESOLVED

The `setInterval` heartbeat in `useSession` now iterates over `loadCourtGroup()` (imported from `sessionService`) and calls `touchSession` for every court whose `sessionId` does not match the currently loaded session. All idle courts in the group receive a heartbeat every 5 minutes alongside the active one, preventing TTL expiry during multi-court sessions.

---

## What Is Needed (Critical)

There are no remaining critical blockers. All original issues are resolved.

---

### ~~1. No Shared Player Pool Across Courts~~ — RESOLVED

A persistent `localStorage` club roster has been added to `sessionService.ts` via four helpers: `loadRoster`, `saveRoster`, `mergeIntoRoster`, `removeFromRoster`. The setup screen now shows a "From Roster" panel:

- **Import**: Checkboxes per saved player, "Select All" shortcut, "Add Selected (N)" button to bulk-add to the temp list. Already-added players are shown struck-through and their checkbox is disabled.
- **Save**: A "Save to Roster" button (`Star` icon) appears as soon as one player is in the temp list. It calls `mergeIntoRoster(tempPlayers)` — no duplicates, existing entries preserved.
- **Remove**: Each roster entry has an × button for individual deletion.
- The roster persists across sessions under `localStorage` key `padq_roster`.

---

### ~~2. No Coordinator View for Multi-Court Sessions~~ — RESOLVED

A `CoordinatorOverlay` component has been added to `page.tsx`. It is accessible via "All Courts" in the `GearMenu` (shown when `isHost && courts.length >= 2`).

The overlay subscribes to every court in `loadCourtGroup()` simultaneously via `subscribeToSession` (one `onSnapshot` per court) and renders a responsive grid of cards showing:
- Court name + live dot
- Current matchup (team vs team for doubles, player vs player for singles)
- Player count, waiting count, engine phase badge, live status
- Expired sessions shown greyed-out with "Session expired"

Closes on Escape or clicking the backdrop. Write actions remain on individual court pages — display-only.

---

## What Could Be Improved

These are not broken but noticeably degrade the experience or maintainability.

---

### 6. No Match Undo

Clicking the wrong winner is unrecoverable without manually editing history and the queue. The host has no recourse other than a hard reset.

A single undo step is sufficient for 99% of cases. Store a snapshot of `{ queue, paddleState, singlesState }` in a ref immediately before each `commitMatchResult`. An "Undo Last Match" button in the `GearMenu` restores the snapshot locally and writes a corrected queue to Firestore.

---

### 7. No Player Sit-Out Feature

Players cannot voluntarily sit out a rotation without being fully removed from the session. In real club settings this is common — someone needs a break, a drink, or is waiting for a partner.

A `sittingOut: string[]` field alongside `waitingQueue` would let the host toggle players in/out without removing them from stats or history. The engines would filter `sittingOut` players from candidate pools.

---

### 8. `page.tsx` Is a ~900-Line Monolith

All three render paths (setup form, host session, viewer session), the `GearMenu` component, and every match handler function live in one file. This makes it difficult to navigate, review, and test independently.

**Suggested split**:
- `components/SetupView.tsx` — player input form, court name, PIN, mode selection
- `components/HostView.tsx` — active host session with match controls
- `components/ViewerView.tsx` — read-only spectator layout
- `GearMenu` → `components/GearMenu/GearMenu.tsx`

`page.tsx` becomes a thin router between the three views.

---

### ~~9. Watch Page URL Is Not Surfaced in Share Panel~~ — ALREADY RESOLVED

`GearMenu` sets `watchUrl = ${window.location.origin}/watch/${sessionId}` and both the "Copy Watch Link" button and the QR code use this value directly. Viewers who follow the link land immediately on the live session — no code entry required.

---

### 10. No Cross-Session Statistics

All player stats (win rate, rank, streak) are computed from the current session's match history only. They vanish when the session expires in 30 minutes. Long-term players have no persistent record.

A lightweight `localStorage` stats store keyed by player name could accumulate results across sessions on the same device without requiring authentication. An optional Firestore `players` collection would enable cross-device persistence.

---

### 11. `hostToken` Loss Has No Recovery Path

If the host clears browser localStorage (or switches devices), `hostToken` is gone. The session still exists in Firestore but the host cannot write to it — they are permanently locked out with no recovery mechanism until the 30-min TTL fires.

A recovery option: show the `hostToken` as a one-time copyable "session key" at session start and let hosts re-enter it via the `GearMenu`.

---

### 12. No "It's Your Turn" Signal for Viewers

Viewers watching on their phones have no indication when they're about to play. They must actively watch the screen.

The Browser Notification API can fire a local push notification when the viewer's registered name appears in queue position 1 or 2. No backend changes needed — viewers opt in by entering their name and granting notification permission.

---

## Suggestions

Additional improvements worth considering for future iterations.

---

### Suggestion A — Persist Minimal Stats to `localStorage`

Track cumulative wins, losses, and games played per player name in `localStorage`. Display a "Career" tab alongside the per-session Analytics tab. Low implementation cost, high perceived value for regular players.

---

### Suggestion B — "Sit Next" / Priority Queue Entry

Let a player who was skipped or just arrived flag themselves as "sitting next." The engine bumps them to the front of the waiting pool for the next available slot. Prevents the awkward "who's been waiting longest" conversation.

---

### Suggestion C — Score History on Watch Page

Viewers can see the current match score but not previous scores. Showing the last 5 match results with scores on the watch page gives context without overwhelming the layout.

---

### Suggestion D — Export Match History

Add an "Export CSV" button in the Analytics tab. Given that history is already structured (`id`, `mode`, `players`, `winner`, `score`, `timestamp`), this is a trivial `Blob` download with no backend required.

---

### Suggestion E — Configurable Win Streak Limit

`SINGLES_MAX_WIN_STREAK = 3` is hardcoded. Some groups prefer 2, some prefer 5. Expose this as a session setup option (slider or dropdown). Store it in `SessionDoc` and pass it into `advanceSinglesState`.

---

### Suggestion F — Offline Resilience

Currently, if Firestore is unreachable (no network), all writes silently fail and the session appears frozen. Firestore's offline persistence (`enableIndexedDbPersistence`) would queue writes locally and sync when the connection is restored — no code changes needed beyond enabling it in `lib/firebase.ts`.

---

## Club-Scale Readiness

Assessment of PadQ for a sports club running 5 simultaneous courts with 50+ players.

| Dimension | Current State | Ready? |
|---|---|---|
| Algorithm correctness | `smartSelectPool` window is capped at 8; performance is constant regardless of player count | Yes |
| Engine state survival | Persisted to Firestore on every match; rehydrated on reload | Yes |
| Session stability | 5-min heartbeat touches all courts in the group | Yes |
| Multi-court management | Independent sessions, tab-switch requires reload | Improved |
| Player assignment | Club roster in localStorage; bulk-assign from setup screen | Yes |
| Coordinator visibility | All-courts overlay in GearMenu; live Firestore subscriptions | Yes |
| INIT fairness | Odd player counts handled correctly (floor-based) | Yes |

**Scale fit summary**:

| Scenario | Ready? |
|---|---|
| 1 court, 8–16 players | Yes |
| 2 courts, up to ~20 players | Usable with care |
| 5 courts, 50+ players | Yes — club-scale blockers resolved |

All club-scale blockers are resolved. The system is now manageable at 5-court / 50-player scale without a fundamental architecture change. The remaining multi-court limitation is that switching courts still requires a page reload — this is a UX inconvenience, not a correctness issue.

---

## Priority Table

| # | Item | Category | Severity | Effort |
|---|---|---|---|---|
| ~~1~~ | ~~Engine state persistence~~ | ~~Needed~~ | ~~Critical~~ | ~~Medium~~ | **RESOLVED** |
| ~~2~~ | ~~Periodic heartbeat~~ | ~~Needed~~ | ~~Critical~~ | ~~Low~~ | **RESOLVED** |
| ~~3~~ | ~~Firestore security rules~~ | ~~Needed~~ | ~~Critical~~ | ~~Low~~ | **RESOLVED** |
| ~~4~~ | ~~Play-all mode bypasses paddle engine~~ | ~~Needed~~ | ~~High~~ | ~~Medium~~ | **RESOLVED** |
| ~~5~~ | ~~Odd player count INIT bug~~ | ~~Needed~~ | ~~Medium~~ | ~~Low~~ | **RESOLVED** |
| ~~6~~ | ~~Multi-court heartbeat gap (idle courts expire)~~ | ~~Needed~~ | ~~High~~ | ~~Low~~ | **RESOLVED** |
| ~~1~~ | ~~No shared player pool / club roster~~ | ~~Needed~~ | ~~High (club)~~ | ~~Medium~~ | **RESOLVED** |
| ~~2~~ | ~~No coordinator view for multi-court~~ | ~~Needed~~ | ~~Medium-High (club)~~ | ~~Medium~~ | **RESOLVED** |
| 6 | Match undo | Improvement | High | Medium |
| 7 | Player sit-out feature | Improvement | High | Medium |
| 8 | `page.tsx` refactor into sub-views | Improvement | Medium | High |
| ~~9~~ | ~~Share panel links to `/watch/{sessionId}`~~ | ~~Improvement~~ | ~~Medium~~ | ~~Low~~ | **ALREADY RESOLVED** |
| 10 | Cross-session statistics | Improvement | Medium | Medium |
| 11 | `hostToken` recovery mechanism | Improvement | Medium | Low |
| 12 | "It's your turn" viewer notification | Improvement | Low | Low |
| A | Persist career stats to `localStorage` | Suggestion | — | Low |
| B | "Sit next" priority entry | Suggestion | — | Low |
| C | Score history on watch page | Suggestion | — | Low |
| D | Export match history as CSV | Suggestion | — | Low |
| E | Configurable win streak limit | Suggestion | — | Low |
| F | Offline resilience via Firestore persistence | Suggestion | — | Low |

---

## Recommended Sequence

**Phase 1 — Stability** ✓ Complete
1. ~~Add Firestore security rules~~ — done
2. ~~Add periodic heartbeat in `useSession`~~ — done
3. ~~Persist engine state to Firestore on every `commitMatchResult`~~ — done

**Phase 2 — Core Fixes** ✓ Mostly complete
4. ~~Fix odd player count INIT handling~~ — done (`Math.floor` in `doublesEngine.ts`)
5. ~~Integrate paddle engine with play-all mode~~ — done (`gameMode === 'doubles'` guard in `page.tsx`)
6. ~~Fix share panel URL to point at `/watch/{sessionId}`~~ — already implemented (`watchUrl` in GearMenu)
7. ~~Extend heartbeat to cover all courts in court group~~ — done (`loadCourtGroup` loop in `useSession.ts`)

**Phase 3 — Club Scale** ✓ Complete
8. ~~Shared player roster in `localStorage` with assign-to-court UI~~ — done
9. ~~Read-only coordinator overview for all active courts~~ — done

**Phase 4 — UX**
10. Match undo (issue 6)
11. Player sit-out (issue 7)
12. `hostToken` recovery display (issue 11)
13. Viewer turn notification (issue 12)

**Phase 5 — Growth**
14. Cross-session `localStorage` stats (issue 10)
15. Export CSV (suggestion D)
16. Configurable streak limit (suggestion E)
17. Offline Firestore persistence (suggestion F)
18. `page.tsx` component split (issue 8)
