# PadQ System Report

**Last updated**: 2026-06-05
**Branch**: main
**Scope**: Full codebase audit — queue algorithms, architecture, security, UX, data layer; club-scale use case assessment (5 courts, 50+ players)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Resolved Issues](#resolved-issues)
3. [What Is Needed (Critical)](#what-is-needed-critical)
4. [What Could Be Improved](#what-could-be-improved)
5. [Suggestions](#suggestions)
6. [Deep Audit Findings](#deep-audit-findings)
7. [Club-Scale Readiness](#club-scale-readiness)
8. [Priority Table](#priority-table)

---

## System Overview

PadQ is a real-time match queue manager for singles and doubles paddle/racket sports. A host creates a session, adds players, and the app manages fair player rotation across four queue modes (Default, Tournament, Play-All, Randomize). Viewers join via a 4-character room code on a separate read-only watch page.

**Stack**: Next.js 16.2.1 · React 19 · Firebase Firestore · TypeScript 5
**Session TTL**: 30 minutes (Firestore auto-delete on `lastActiveAt`)
**Queue modes**: Default, Tournament, Play-All, Randomize
**Game modes**: Singles (king-of-court), Doubles (INIT → WINNERS → LOSERS cycle)

**Current scale fit**: Well-suited for 1 court with 8–16 players. Ready for 5+ courts and 50+ players — club-scale roster and coordinator overlay are now implemented.

**Real-world club usage pattern**: Clubs typically start a fresh session every time because there are always new players. This means localStorage-based career stats and roster persistence are not practical concerns — clubs do not expect cross-session history to carry over. The roster feature is still useful for quickly re-adding regulars without retyping. The primary operational pain point is managing absent or late-arriving players whose names are already in the queue.

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

### ~~6. No Match Undo~~ — RESOLVED

Single-step undo is implemented. Before every `handleSinglesMatch` / `handleDoublesMatch` / `handleCourtMatch`, a snapshot of `{ queue, paddleState, singlesState, courtSlots? }` is saved to `undoSnapshotRef`. The GearMenu shows an "Undo Last Match" item (via `canUndo` state flag) only when a snapshot exists. On undo: local queue, engine refs, and court slots are restored, the Firestore queue/engine state is written back via `session.undoLastMatch`, and the latest history entry is deleted via `deleteLatestHistoryEntry` in `sessionService.ts`.

---

### ~~7. No Player Sit-Out Feature~~ — RESOLVED

`sittingOut: string[]` added to `SessionDoc` and `SessionState`. A collapsible `SitOutPanel` component appears in the host view below the live tools row. Toggling a player out removes them from the queue and excludes them from `advancePaddleState` / `advanceSinglesState` candidate pools. Toggling them back adds them to the end of the queue. State is persisted to Firestore via `syncField` so all clients stay in sync.

---

### ~~8. `page.tsx` Is a ~900-Line Monolith~~ — RESOLVED

Four components extracted from `page.tsx`:
- `components/GearMenu/GearMenu.tsx` — settings dropdown (now also handles Undo Last Match)
- `components/CoordinatorOverlay/CoordinatorOverlay.tsx` — all-courts read-only overlay
- `components/SetupView/SetupView.tsx` — player input form, PIN, roster, court count
- `components/SitOutPanel/SitOutPanel.tsx` — new sit-out toggle panel

`page.tsx` is now a thin orchestrator: state, handlers, and the three render paths (setup, tournament, default/play-all). Render paths remain in `page.tsx` for now as they share too much internal state to extract without a Context layer.

---

### ~~9. Watch Page URL Is Not Surfaced in Share Panel~~ — ALREADY RESOLVED

`GearMenu` sets `watchUrl = ${window.location.origin}/watch/${sessionId}` and both the "Copy Watch Link" button and the QR code use this value directly. Viewers who follow the link land immediately on the live session — no code entry required.

---

### ~~10. No Cross-Session Statistics~~ — RESOLVED

`recordCareerResult()` in `sessionService.ts` is called after every match and accumulates wins, losses, and games played per player name in `localStorage` under key `padq_career_stats`. `loadCareerStats()` and `saveCareerStats()` manage the store. `AnalyticsDashboard` now shows a "Career" tab alongside "Session" whenever career data exists, displaying all-time stats sorted by wins.

---

### ~~11. `hostToken` Loss Has No Recovery Path~~ — RESOLVED

After `startSession`, a dismissable banner displays the `hostToken` as a one-time copyable "session key." `GearMenu` exposes a "Recover as Host" form for viewers and locked-out hosts: entering the correct token calls `handleRecoverHost()`, which validates against Firestore and calls `saveHostToStorage()` on success, restoring write access without a new session.

---

### ~~12. No "It's Your Turn" Signal for Viewers~~ — RESOLVED

The watch page (`app/watch/[sessionId]/page.tsx`) tracks the previous match key in `prevMatchKeyRef`. When the on-court players change, a fixed overlay appears at the top of the screen announcing "NEXT UP ON COURT" with the new matchup (singles: player vs player; doubles: team vs team). The overlay auto-dismisses after 6 seconds. No identity system required — every viewer sees the broadcast simultaneously.

---

## Suggestions

Additional improvements worth considering for future iterations.

---

### ~~Suggestion A — Persist Minimal Stats to `localStorage`~~ — RESOLVED (as Issue 10)

---

### ~~Suggestion B — Player Substitute / Absent Player Handling~~ — RESOLVED

Two host-controlled features share the same queue-reorder mechanism, both synced to Firestore via `syncField`:

- **Absent player**: Host taps the `UserX` icon next to any on-court player in the DoublesMatch component or the singles current-match section. A "Replace X with:" picker appears showing all waiting players (queue[4+] for doubles, queue[2+] for singles, minus sitting-out). Selecting a replacement swaps them into the absent player's queue slot; the absent player is moved to `sittingOut` and can be returned via SitOutPanel. Queue and sittingOut are persisted to Firestore in a single `syncField` call.
- **Sit Next**: In the "Waiting — tap ▲" section below the upcoming matches table (visible to host only when ≥ 2 players are waiting), each non-first waiting player has a purple "▲ Next" button. Clicking it moves that player to queue position `onCourtCount` (4 for doubles, 2 for singles) — immediately next to play. Queue is synced to Firestore.

Touch points: `DoublesMatch.tsx` (added `onMarkAbsent` prop + `UserX` button per player); `page.tsx` (added `substituteFor` state, `handleMarkAbsent`, `handleConfirmSub`, `handleSitNext` handlers, sub-picker panel, sit-next section in pairings container, absent buttons in singles match section); `QueueSystem.css` (`.player-btn-cell`, `.absent-mini-btn`, `.player-with-absent`, `.sub-picker-panel`, `.sit-next-section`, `.sit-next-btn`).

---

### ~~Suggestion C — Score History on Watch Page~~ — RESOLVED

The watch page history panel (toggled by "Show/Hide Match History") now shows only the **last 5 results** by default. When there are more than 5 entries, a "Show all N results" button appears below the list. Clicking it expands to the full history; clicking again collapses back to 5. Controlled by `showAllHistory` state; no backend change — history subscription remains unchanged.

---

### Suggestion D — CSV Export and Import

**Export**: An "Export CSV" button in the Analytics tab downloads the session's match history (`id`, `mode`, `players`, `winner`, `score`, `timestamp`) as a `Blob` — no backend required. Useful for clubs keeping session archives or resolving score disputes after the fact.

**Import (roster)**: A companion "Import CSV" on the setup screen lets a coordinator upload a previously exported roster file to bulk-add regulars without retyping. Bridges device switches for coordinators who manage the same player list week to week.

Note: career stat persistence is not the driver here — clubs start fresh each session and do not expect cross-session history. The value is roster portability and match record archiving.

---

### Suggestion E — Configurable Win Streak Limit

`SINGLES_MAX_WIN_STREAK = 3` is hardcoded. Some groups prefer 2, some prefer 5. Expose this as a session setup option (slider or dropdown). Store it in `SessionDoc` and pass it into `advanceSinglesState`.

---

### Suggestion F — Offline Resilience

Currently, if Firestore is unreachable (no network), all writes silently fail and the session appears frozen. Firestore's offline persistence (`enableIndexedDbPersistence`) would queue writes locally and sync when the connection is restored — no code changes needed beyond enabling it in `lib/firebase.ts`.

---

## Deep Audit Findings

A second full codebase pass (2026-05-25) surfaced the following bugs, logic issues, and UX gaps not covered by the original audit. Items are grouped by category and ordered by impact.

---

### Bugs

#### ~~DA-1. `ScoreBoard` initial `limit` / `baseLimit` mismatch~~ — RESOLVED

`useState(21)` for `limit` vs `useState(11)` for `baseLimit` in `ScoreBoard.tsx`. On first use (before clicking a preset), deuce triggered at 10-10 while the UI displayed "to 21". The `onScoreChange` Firestore write on mount emitted `limit: 11` so viewers also saw the wrong limit.

**Fix**: Changed initial `limit` to `11` so both values start in sync. Clicking the 11 or 21 preset still overrides both correctly (`ScoreBoard.tsx:22`).

---

#### ~~DA-2. Live player add in singles default mode didn't update the singles engine~~ — RESOLVED

`handleAddPlayerLive` called `addPlayerToWaiting` for doubles but had no equivalent path for singles. In singles default mode, the new player appeared in the session queue but `singlesStateRef` never learned about them — the engine continued scheduling the old player set, ignoring the newcomer.

**Fix**: Added `addPlayerToSinglesWaiting` to the singles engine import and an `else if (activeQueueMode === 'default' && gameMode === 'singles')` branch that registers the player in `singlesStateRef` / `setSinglesStateUI` (`page.tsx:642-651`).

---

#### ~~DA-3. Multi-court match results not recorded in career stats~~ — RESOLVED

`handleCourtMatch` (the multi-court doubles path) appended to `localHistory` and called `session.commitMatchResult` but never called `recordCareerResult` or `setCareerStats`. All multi-court wins/losses were invisible to the Career tab in `AnalyticsDashboard`.

**Fix**: Added `recordCareerResult(entry.players, entry.winner)` and `setCareerStats(loadCareerStats())` inside `handleCourtMatch`, after the history entry is built — matching what `addHistory` already does for single-court matches (`page.tsx:626-627`).

---

#### ~~DA-4. Hard Reset wipes roster and career stats~~ — RESOLVED

`handleHardReset` in `page.tsx` now calls `clearHostFromStorage()` and `clearCourtGroup()` (both already exported from `sessionService.ts`) instead of `localStorage.clear()`. This removes only `padq_session_id`, `padq_host_token`, `padq_game_mode`, and `padq_court_group` — leaving `padq_roster` and `padq_career_stats` intact. The confirm dialog text updated to reflect that roster and career stats are preserved.

---

#### ~~DA-5. Room code has no collision check~~ — RESOLVED

`createSession` in `sessionService.ts` now reads the candidate document before writing. If it already exists, `generateRoomCode()` is called again in a loop until a free code is found. Cost: one extra `getDoc` on session creation in the (rare) collision case.

---

#### ~~DA-6. History subscription is unbounded~~ — RESOLVED

Added `limit(100)` to the `subscribeToHistory` query in `sessionService.ts`. The watch page's "Show all / last 5" toggle already handles display-side pagination, so no UI change needed. 100 entries covers any realistic club session.

---

### Logic / Algorithm Issues

#### ~~DA-7. Sitting-out players remain in singles engine's internal queue~~ — RESOLVED

`handleToggleSitOut` now syncs engine refs alongside the session queue. Sitting out removes the player from `singlesStateRef.current.queue`, `waitingQueue`, and nulls `king` if they were king. Returning calls `addPlayerToSinglesWaiting`. Same fix applied to doubles: sitting out filters the player from all three paddle pools (`w1`, `l1`, `waitingQueue`); returning calls `addPlayerToWaiting`.

---

#### ~~DA-8. Fatigue penalty double-counted in `smartSelectPool`~~ — RESOLVED

Removed the extra per-player fatigue loop inside `smartSelectPool` (`doublesEngine.ts`). `scoreCandidate` already applies `PENALTY_FATIGUE` for each fatigued player in every pairing it evaluates, so `minPairingScore` already reflects fatigue correctly. The outer loop was doubling the effective penalty to `2×PENALTY_FATIGUE`.

---

#### ~~DA-9. Engine state diverges after manual queue operations~~ — RESOLVED

`handleToggleSitOut`, `handleSitNext`, and `handleConfirmSub` now all sync engine refs after modifying the session queue.

- **Sit-out / return**: covered by the DA-7 fix above — engine pools are kept in sync on every toggle.
- **Sit Next**: after reordering the session queue, moves the player to position 0 of their current engine pool (w1/l1/waitingQueue for doubles; queue/waitingQueue for singles). `smartSelectPool` searches from position 0, so they are guaranteed to be in the selection window for the next match.
- **Substitute**: removes the absent player from all engine pools. In singles, if the absent player was king, the substitute is installed as king; if they were a challenger, their engine queue slot is remapped to the substitute. The substitute is also removed from wherever they sat in the engine queue to avoid duplication.

---

### UX Issues

#### ~~DA-10. `alert()` / `confirm()` used throughout~~ — RESOLVED

All seven native dialogs replaced with in-app UI:

- **Validation alerts** (`"Player already added"`, `"Player already exists"`): replaced with a `showToast()` helper that renders a fixed-bottom notification and auto-dismisses after 3 s. The unreachable start-queue alert (button already disabled at that threshold) was simply removed.
- **Setup duplicate warning**: inline `errorMsg` prop added to `SetupView` — shown as red text below the name input, cleared on the next successful add.
- **Destructive confirmations** (Hard Reset, Clear History, Remove Court, Back Home): replaced with a `pendingConfirm` state that renders a styled overlay (`confirm-overlay` / `confirm-dialog`) matching the app's dark UI. Cancel dismisses; Confirm/Leave executes the action via `doConfirmedAction()`.

New CSS: `.toast-notification`, `.confirm-overlay`, `.confirm-dialog`, `.confirm-btn`, `.setup-error-msg` added to `QueueSystem.css`.

---

#### ~~DA-11. "Back" navigates mid-session without warning~~ — RESOLVED

Added `handleBackHome` in `page.tsx`. When the user is the host of an active, non-expired session, it shows a confirm dialog before navigating ("The session stays active — rejoin anytime with the room code."). Viewers and the setup screen navigate without a prompt. Both active-session Back buttons now call `handleBackHome` instead of `router.push('/')` directly.

---

#### ~~DA-12. Roster deduplication is case-sensitive~~ — RESOLVED

`mergeIntoRoster` in `sessionService.ts` now builds the seen-set from lowercased existing names and filters incoming names by their lowercase form — so "Alice" and "alice" are treated as the same entry. The SetupView "already added" checks (`disabled` and `roster-name--added` class) also updated to use `p.toLowerCase() === name.toLowerCase()` comparisons.

---

#### ~~DA-13. `CLAUDE.md` documents wrong INIT formula~~ — RESOLVED

Updated `CLAUDE.md` INIT scaling line to `Math.max(1, Math.floor(allPlayers.length / 4))` with a note that remainder players flow into `waitingQueue`.

---

#### ~~DA-14. `getPartneredQueue` is a dead no-op~~ — RESOLVED

Removed the `useCallback` declaration and replaced its single call site in `handleStartQueue` with an inline `[...tempPlayers]` spread.

---

#### ~~DA-15. `buildPlayerStats` / atom types duplicated in watch page~~ — RESOLVED

Removed local `RankTier`, `PlayerStat`, `RANK_CFG`, `calcRank`, and `buildStats` from `watch/[sessionId]/page.tsx`. Now imports `buildPlayerStats` from `playerUtils.ts`, `RankTier`/`PlayerStat` from `types.ts`, and `RankBadge`/`StreakBadge` from the shared atoms. Added an optional `className` prop (default: existing class name) to both atom components so the watch page can pass `"w-rank-badge"` / `"w-streak-badge"` without touching its CSS.

---

#### ~~DA-16. `commitMatchResult` is not atomic~~ — RESOLVED

Added `batchMatchResult` to `sessionService.ts`: combines the session-doc queue patch and the new history subcollection doc into a single `writeBatch` commit. `commitMatchResult` in `useSession.ts` now calls `batchMatchResult` instead of the previous two-step `updateQueueSafely` + `addHistoryEntry` sequence. Viewers will never see the new queue without the matching history entry.

---

#### ~~DA-17. Multi-court matches leave stale undo state~~ — RESOLVED

`handleCourtMatch` now saves a full undo snapshot — `{ queue, paddleState, singlesState, courtSlots }` — before mutating any state and calls `setHasUndo(true)`. `UndoSnapshot` type extended with `courtSlots?: CourtSlot[]`. `handleUndoLastMatch` restores `localCourtSlots` from the snapshot and includes `courtSlots` in the Firestore `undoLastMatch` patch when present, so multi-court layout is fully rolled back on undo.

---

#### ~~DA-18. No double-click guard on match result buttons~~ — RESOLVED

Added `isProcessingMatchRef = useRef(false)` in `page.tsx`. All three match handlers (`handleSinglesMatch`, `handleDoublesMatch`, `handleCourtMatch`) check the ref at entry and return immediately if a match is already processing. The flag is set to `true` at the start of each handler and cleared to `false` at the end (including all early-return paths in `handleCourtMatch`).

---

#### ~~DA-19. `clearHistory` bypasses application-level host token check~~ — RESOLVED

`clearHistory` now accepts a `hostToken` parameter and reads the session document to verify identity before executing the batch delete. `clearMatchHistory` in `useSession.ts` now guards on `hostToken` presence and passes it through.

---

#### ~~DA-20. CLAUDE.md Firestore schema is missing four fields~~ — RESOLVED

Added `doublesEngineState`, `singlesEngineState`, `courtSlots`, and `sittingOut` to the Firestore schema block in `CLAUDE.md` with type annotations and descriptions.

---

#### ~~DA-21. `CourtView.tsx` is a dead stub~~ — RESOLVED

Deleted `app/queue/components/CourtView.tsx`. Updated the `CLAUDE.md` project structure entry to `CourtCard/` (single-court card used in the coordinator overlay grid), which is the component that actually fills that role.

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

**Club fit re-assessment**: Concerns about localStorage-based data persistence (career stats, roster) are largely irrelevant for real club use. Clubs start fresh each session due to a rotating pool of players including new faces every week. No one expects historical data to carry over. The roster speeds up setup for regulars; session stats reset cleanly for fairness. The highest-impact unresolved gap for club coordinators is handling absent or late players — a player's name is in the queue but they are not on court, and the host needs to substitute them without voiding the match or manually re-entering the queue.

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
| ~~6~~ | ~~Match undo~~ | ~~Improvement~~ | ~~High~~ | ~~Medium~~ | **RESOLVED** |
| ~~7~~ | ~~Player sit-out feature~~ | ~~Improvement~~ | ~~High~~ | ~~Medium~~ | **RESOLVED** |
| ~~8~~ | ~~`page.tsx` refactor into sub-views~~ | ~~Improvement~~ | ~~Medium~~ | ~~High~~ | **RESOLVED** |
| ~~9~~ | ~~Share panel links to `/watch/{sessionId}`~~ | ~~Improvement~~ | ~~Medium~~ | ~~Low~~ | **ALREADY RESOLVED** |
| ~~10~~ | ~~Cross-session statistics~~ | ~~Improvement~~ | ~~Medium~~ | ~~Medium~~ | **RESOLVED** |
| ~~11~~ | ~~`hostToken` recovery mechanism~~ | ~~Improvement~~ | ~~Medium~~ | ~~Low~~ | **RESOLVED** |
| ~~12~~ | ~~"It's your turn" viewer notification~~ | ~~Improvement~~ | ~~Low~~ | ~~Low~~ | **RESOLVED** |
| ~~A~~ | ~~Persist career stats to `localStorage`~~ | ~~Suggestion~~ | ~~—~~ | ~~Low~~ | **RESOLVED (as Issue 10)** |
| ~~B~~ | ~~Player substitute / absent player handling~~ | ~~Suggestion~~ | ~~High (club)~~ | ~~Medium~~ | **RESOLVED** |
| ~~C~~ | ~~Score history on watch page~~ | ~~Suggestion~~ | ~~—~~ | ~~Low~~ | **RESOLVED** |
| D | CSV export (history) + import (roster) | Suggestion | — | Low |
| E | Configurable win streak limit | Suggestion | — | Low |
| F | Offline resilience via Firestore persistence | Suggestion | — | Low |
| ~~DA-1~~ | ~~ScoreBoard `limit`/`baseLimit` mismatch~~ | ~~Bug~~ | ~~High~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-2~~ | ~~Live player add doesn't update singles engine~~ | ~~Bug~~ | ~~High~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-3~~ | ~~Multi-court matches not in career stats~~ | ~~Bug~~ | ~~Medium~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-4~~ | ~~Hard Reset wipes roster + career stats~~ | ~~Bug~~ | ~~Medium~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-5~~ | ~~Room code collision (no uniqueness check)~~ | ~~Bug~~ | ~~Low~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-6~~ | ~~History subscription unbounded~~ | ~~Perf~~ | ~~Medium~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-7~~ | ~~Sitting-out players remain in singles engine queue~~ | ~~Logic~~ | ~~High~~ | ~~Medium~~ | **RESOLVED** |
| ~~DA-8~~ | ~~Fatigue penalty double-counted in `smartSelectPool`~~ | ~~Logic~~ | ~~Medium~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-9~~ | ~~Engine diverges after manual queue operations~~ | ~~Logic~~ | ~~Medium~~ | ~~High~~ | **RESOLVED** |
| ~~DA-10~~ | ~~`alert()` calls throughout~~ | ~~UX~~ | ~~Medium~~ | ~~Medium~~ | **RESOLVED** |
| ~~DA-11~~ | ~~Back button mid-session no warning~~ | ~~UX~~ | ~~Medium~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-12~~ | ~~Roster deduplication case-sensitive~~ | ~~UX~~ | ~~Low~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-13~~ | ~~`CLAUDE.md` INIT formula stale~~ | ~~Docs~~ | ~~—~~ | ~~Trivial~~ | **RESOLVED** |
| ~~DA-14~~ | ~~`getPartneredQueue` dead no-op~~ | ~~Code~~ | ~~—~~ | ~~Trivial~~ | **RESOLVED** |
| ~~DA-15~~ | ~~Stats/types duplicated in watch page~~ | ~~Code~~ | ~~Low~~ | ~~Medium~~ | **RESOLVED** |
| ~~DA-16~~ | ~~`commitMatchResult` non-atomic~~ | ~~Code~~ | ~~Low~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-17~~ | ~~Multi-court matches leave stale undo state~~ | ~~Bug~~ | ~~Medium~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-18~~ | ~~No double-click guard on match result buttons~~ | ~~Bug~~ | ~~Medium~~ | ~~Low~~ | **RESOLVED** |
| ~~DA-19~~ | ~~`clearHistory` bypasses host token check~~ | ~~Security~~ | ~~Low~~ | ~~Trivial~~ | **RESOLVED** |
| ~~DA-20~~ | ~~CLAUDE.md schema missing 4 fields~~ | ~~Docs~~ | ~~—~~ | ~~Trivial~~ | **RESOLVED** |
| ~~DA-21~~ | ~~`CourtView.tsx` dead stub (wrong CLAUDE.md entry)~~ | ~~Code~~ | ~~—~~ | ~~Trivial~~ | **RESOLVED** |

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

**Phase 4 — UX** ✓ Complete
10. ~~Match undo (issue 6)~~ — done
11. ~~Player sit-out (issue 7)~~ — done
12. ~~`page.tsx` component split (issue 8)~~ — done (GearMenu, CoordinatorOverlay, SetupView, SitOutPanel extracted)
13. ~~`hostToken` recovery display (issue 11)~~ — done (banner on session start + GearMenu recovery form)
14. ~~Viewer match-start pop-up (issue 12, Option B)~~ — done (`prevMatchKeyRef` + 6-sec overlay on watch page)
15. ~~Cross-session `localStorage` stats (issue 10)~~ — done (`recordCareerResult` + Career tab in AnalyticsDashboard)

**Phase 5 — Growth**
16. ~~Player substitute / absent player handling (suggestion B)~~ — done
17. ~~Score history on watch page (suggestion C)~~ — done (last 5 + show-all toggle)
18. CSV export for match history + CSV import for roster (suggestion D)
19. Configurable streak limit (suggestion E)
20. Offline Firestore persistence (suggestion F)

**Phase 6 — Bug Fixes (Deep Audit 2026-05-25)** ✓ Mostly complete
21. ~~ScoreBoard `limit`/`baseLimit` mismatch (DA-1)~~ — done (`ScoreBoard.tsx:22`, `useState(11)`)
22. ~~Live player add doesn't update singles engine (DA-2)~~ — done (`addPlayerToSinglesWaiting` in `handleAddPlayerLive`)
23. ~~Multi-court matches not in career stats (DA-3)~~ — done (`recordCareerResult` in `handleCourtMatch`)
24. ~~Hard Reset wipes roster + career stats (DA-4)~~ — done (`clearHostFromStorage` + `clearCourtGroup` instead of `localStorage.clear()`)
25. ~~Room code collision check (DA-5)~~ — done (`getDoc` uniqueness loop before `setDoc` in `createSession`)
26. ~~Unbounded history subscription (DA-6)~~ — done (`limit(100)` added to `subscribeToHistory` query)
27. ~~Sitting-out players remain in singles engine queue (DA-7)~~ — done (engine refs synced on every sit-out/return toggle; both singles and doubles)
28. ~~Fatigue double-counted in `smartSelectPool` (DA-8)~~ — done (removed duplicate outer loop; `minPairingScore` already includes fatigue)
29. ~~Engine diverges after manual queue ops (DA-9)~~ — done (sit-out, sit-next, and substitute handlers now all sync engine refs)
30. ~~`alert()` calls replaced with inline UX (DA-10)~~ — done (toast for validation messages; confirm overlay for destructive actions; setup inline error for setup-phase alerts)
31. ~~Back button mid-session no warning (DA-11)~~ — done (`handleBackHome` with host-only confirm guard)
32. ~~Roster deduplication case-sensitive (DA-12)~~ — done (`mergeIntoRoster` + SetupView checks lowercased)
33. ~~Stale `CLAUDE.md` INIT formula (DA-13)~~ — done
34. ~~Dead `getPartneredQueue` no-op (DA-14)~~ — done

**Phase 7 — Deep Audit 2026-05-30 (new findings)** ✓ Partially complete
35. ~~Multi-court matches leave stale undo state (DA-17)~~ — done (`handleCourtMatch` now saves `UndoSnapshot` with `courtSlots`; undo restores court slots + syncs Firestore)
36. ~~No double-click guard on match result buttons (DA-18)~~ — done (`isProcessingMatchRef` guards all three match handlers)
37. ~~`clearHistory` bypasses host token check (DA-19)~~ — done (`hostToken` param + identity check in `clearHistory`)
38. ~~CLAUDE.md schema missing 4 fields (DA-20)~~ — done
39. ~~`CourtView.tsx` dead stub + wrong CLAUDE.md entry (DA-21)~~ — done
40. ~~Stats/types duplicated in watch page (DA-15)~~ — done (shared imports + `className` prop on atoms)
41. ~~`commitMatchResult` non-atomic (DA-16)~~ — done (`batchMatchResult` in sessionService)

---

## Skilled Mode Development

> All items below are specific to the Skilled queue mode feature added on 2026-06-01.

---

### Completed Today

✅ Added **Skilled** as a 4th mode tab alongside Default, Tournament, and Play-all

✅ Created **Skill Bracket table UI** — three collapsible sections (Beginner / Intermediate / Advanced) each with player count badge, colour indicator, add/remove player controls, and roster-picker panel

✅ Connected Skill Bracket to the **shared session player list** — existing queue players appear in bracket assignment; players already assigned to one bracket are shown with a coloured badge in others

✅ Added ability to **add brand-new players** directly from the Skill Bracket table — they are added to the global session roster simultaneously

✅ Implemented **`skilledMatchmakingEngine.ts`** — fully isolated from Default mode engine. Exposes:
- `buildSkillQueue(players, skillBrackets)` — groups players by level, untagged → Intermediate
- `assignCourts(skillQueue, courtDefs)` — fills courts using priority cascade
- `rotatePlayers(completedPlayers, state, brackets)` — players rejoin the back of their own skill group
- `reassignCourt(courtId, state, brackets)` — picks next best group when a court opens
- `initSkilledState`, `addPlayerToSkilledState`, `retagPlayerInQueue`

✅ Implemented **4-priority matchmaking cascade**:
- P1 Pure — all 4 same level
- P2 Majority + 1 adjacent fill (never Beginner ↔ Advanced)
- P3 Split fill across adjacent pairs (B+I or I+A only)
- P4 Full open — last resort, `console.warn` fired, B+A only if no Intermediate exists

✅ Defined **`SkilledState`** shape — fully isolated from Default mode state (`skilledState.courts`, `skilledState.skillQueue`, `skilledState.waitingQueue`)

✅ Built **Skilled mode court cards** — header with level tag (BEGINNER COURT / INTERMEDIATE COURT / ADVANCED COURT / MIXED), per-player skill badges (B / I / A), Team A / Team B win buttons wired to `handleSkilledResult`

✅ Built **skill-grouped waiting queue display** — grouped by Beginner → Intermediate → Advanced with coloured labels, dividers, and per-group position numbers (#1, #2…)

✅ Skill bracket assignments persist to **localStorage** (`padq_skilled_brackets`) — survive page refresh

✅ Mid-session **re-tag** handled — `handleAssignToBracket` calls `retagPlayerInQueue` so live queue reflects new skill level immediately (on-court players are not interrupted)

✅ Mid-session **Add Player** feeds the skilled engine — `handleAddPlayerLive` calls `addPlayerToSkilledStateEngine` when in Skilled mode

✅ **Untagged player notice** — a dismissable banner above the court grid warns the host when any session player has no skill tag. Untagged players are silently treated as Intermediate by the engine.

✅ **Per-player skill badge** (B / I / A) on every court card slot — `getPlayerBracketLevel` colours each name chip.

✅ **PURE / MIXED court label** on the court card header driven by `court.matchLevel` returned from the matchmaking engine.

✅ **Skill-grouped waiting queue** — grouped by Beginner → Intermediate → Advanced with coloured group labels, dividers, and per-group position numbers (#1, #2…).

✅ **Mid-session re-tag safety** — `retagPlayerInQueue` checks `isOnCourt` and exits early for on-court players; only waiting-queue players are moved to the new bracket immediately.

✅ **Skilled stats tab in AnalyticsDashboard** — "Skilled" tab (default when in Skilled mode) shows per-bracket leaderboards (Beginner / Intermediate / Advanced) with W/L/GP/Win% and colour-matched bars. Session stats are grouped by `skilledBrackets` assignments; players with no games show "No matches played yet."

✅ **Visual polish** — Team B label typo fixed (colour now applies); Team A / B divider line added to court cards; win buttons default-tinted blue/pink; active court cards get a coloured left-border accent driven by `matchLevel` (green / amber / red / grey).

---

### ~~🐛 Critical Bug — Courts not rendering in Skilled mode~~ — RESOLVED (2026-06-03)

**Root cause:** `activeQueueMode` is resolved from `session.queueMode` (Firestore) when connected, not from local state. When a host reloads the page with `queueMode: 'skilled'` already persisted, the `onSnapshot` fires and sets `activeQueueMode = 'skilled'`, but `skilledState` is still `null` because `handleModeChange` — the only previous init path — is never called on reconnect. The render then hits `isSkilled && !skilledState` and shows the fallback message.

**Fix:** Added a `useEffect` in `page.tsx` (line 364) that watches `[activeQueueMode, players, courtSlots]`. When `activeQueueMode === 'skilled'`, `skilledState === null`, and `players.length > 0`, it calls `initSkilledState` with the current court defs and brackets. The three guards prevent any re-initialization once the state is populated.

---

### ~~🐛 Engine Bug — Idle court never fills when rest pool bridges the gap~~ — RESOLVED (2026-06-03)

**Symptom:** Court 1 shows "Waiting for players…" indefinitely while ≥ 4 players exist across the active queue + rest pool combined (e.g. 2 Advanced in queue + 2 Beginners resting from the previous Court 2 game).

**Root cause (two compounding flaws):**
1. `fillIdleCourts` used `court.idleCycles < idleThreshold` (default 2) as its gate. `idleCycles` is only incremented inside `reassignCourt`, which is only called for the court that *just finished* a game. A court that was idle from the start (e.g. not enough players at init time) stays at `idleCycles = 0` forever — it never reaches the threshold.
2. Even if the threshold were reached, the engine was not accounting for the rest pool when deciding whether a fill was possible.

**Fix:** Rewrote `fillIdleCourts` in `skilledMatchmakingEngine.ts`. The `idleThreshold` gate is gone. The sole guard is now `totalAvailable = waiting + restPool.length < 4` — if there literally are not 4 players available anywhere, the court legitimately waits; otherwise it fills immediately. Player selection priority: active queue first (all of them), then rest pool supplemented by players with the lowest `cyclesRemaining` (most overdue to play). Snake-order team balance applied to the final 4.

**Idle court message** is now dynamic (computed per court card in the render):
- *"Waiting for N more players…"* — pool is short, host sees exact count
- *"Waiting for N more… (M resting)"* — rest pool is the bottleneck, host knows why
- *"Filling court…"* — unreachable state after the fix; shown as a safety fallback

---

### ~~Stats tab for Skilled mode~~ — RESOLVED (2026-06-05)

`AnalyticsDashboard` now accepts a `skilledBrackets` prop. When in Skilled mode, a **Skilled** tab appears as the default (left-most) tab in the analytics panel. It renders three bracket sections (Beginner / Intermediate / Advanced), each with a mini-leaderboard: rank, player name, wins, losses, games played, and win% with a color-matched bar. Players with no match history yet show "No matches played yet" rather than an empty table. `page.tsx` passes `skilledBrackets` only when `isSkilled` is true so the tab doesn't appear in other modes.

---

### ~~Visual polish — court cards, queue, badge styling~~ — RESOLVED (2026-06-05)

Four targeted fixes:

- **Team B label typo fixed** — `.skilled-court-team--b .skilled-court-label` corrected to `.skilled-team-label`; the pink `#f472b6` colour now actually applies to Team B player rows.
- **Team A / Team B divider** — a `1px` border separates the two teams inside each court card; teams are no longer visually merged.
- **Win buttons default-tinted** — Team A win button is default-blue (`rgba(96,165,250,.06)` background), Team B is default-pink (`rgba(244,114,182,.06)`), not just on hover. Teams are visually distinct at a glance before any interaction.
- **Court card level accent** — active courts receive a coloured left border driven by `matchLevel`: green for Beginner, amber for Intermediate, red for Advanced, grey for Mixed. Idle courts have no accent (no `matchLevel` class applied).

---

### Remaining Tasks

#### 🟢 Lower Priority

- [ ] Undo support for Skilled mode result (currently saves a snapshot of paddle/singles state which is irrelevant in Skilled mode; no Skilled-specific undo yet)

---

### End Goal

The end goal of Skilled mode is a **fully autonomous skill-aware queue management system** for padel sessions where players of different experience levels play together.

The host should be able to:
1. Assign players to Beginner, Intermediate, or Advanced brackets once at session start
2. Switch to Skilled mode and have courts automatically fill with same-level players
3. Never manually arrange courts — the engine handles all grouping and rotation
4. See at a glance which courts are pure-skill matches and which are mixed fills
5. Trust that Beginners and Advanced players are never paired unless absolutely unavoidable

The system must feel **identical to Default mode** in speed, court flow, and queue rotation — the only visible difference to the host is that court assignments are skill-aware.
