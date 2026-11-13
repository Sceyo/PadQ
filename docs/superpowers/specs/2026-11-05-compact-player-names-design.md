# Compact Player Display Name Design

## Intent & Why
In small mobile viewports (e.g. 390px iPhone displays) and tight court cards/chips, long player names (such as "Anna Leigh Waters" or "Quang Dong") wrap awkwardly or consume excessive screen real estate. Displaying initials for given names while preserving the full surname keeps the UI clean, readable, and compact.

## Goals, Non-Goals, and Anti-Goals
- **Goals:**
  - Automatically abbreviate multi-word names on display:
    - 2 words: `Quang Dong` → `Q. Dong`
    - 3+ words: `Anna Leigh Waters` → `A.L. Waters`
    - 1 word: `Ben` → `Ben` (unchanged)
  - Retain full player name in accessible tooltips (`title`) and screen-reader announcements (`aria-label`).
- **Non-Goals:**
  - Mutating input strings in form fields (the user still types or pastes full names).
  - Changing how names are stored in database documents or local storage.
- **Anti-Goals:**
  - Never alter underlying player identity in state or Firestore: "Alan Waters" and "Anna Waters" must remain distinct player entities in the matchmaking engine, queue order, and stats even if both render as `A. Waters`.
  - Never break existing Playwright tests or change rules schemas.

## Constraints
- Zero changes to `firestore.rules` or the `SessionDoc` data model (`players` must remain `string[]`).
- Full names must be preserved in all state, actions, and event handlers (`onSelectPlayer`, `onWin`, `commitCourtResult`).

## Approaches Considered
1. **Approach A: Pure Display-Layer Formatting via Centralized Utility (Selected)**
   - Formats strings strictly when rendering React nodes (`PlayerLabel`, spectator chips, leaderboard cells) using `formatDisplayName(fullName)`.
   - *Why chosen:* Guarantees 100% collision safety, preserves full name data for exports/roster, zero schema risk.
2. **Approach B: Ingestion-Time Mutation (Rejected)**
   - Shorten names immediately when pasted or typed in setup.
   - *Why rejected:* Irreversibly discards the user's real name; introduces catastrophic identity collisions when two people share initials and surname.
3. **Approach C: Model Refactor to `{ id, fullName, displayName }` (Rejected)**
   - *Why rejected:* Massive breaking change across Firestore rules, backend transactions, and existing engine tests for a purely visual enhancement.

## Technical Specification

### 1. Formatting Function: `formatDisplayName(name: string): string`
Located in `app/queue/lib/playerUtils.ts`:
- Trims whitespace and splits by spaces `/\s+/`.
- If 1 token: returns raw string.
- If 2 tokens: `${tokens[0][0].toUpperCase()}. ${tokens[1]}`
- If 3+ tokens:
  - Last token is `surname`.
  - Leading tokens `0..length-2` map to `${token[0].toUpperCase()}.` joined without spaces (e.g. `['Anna', 'Leigh']` → `A.L.`).
  - Returns `${initials} ${surname}`.

### 2. UI Component Integration
- **`PlayerLabel.tsx`:** Renders `<span className="player-label" title={name}>{formatDisplayName(name)}...</span>`. This automatically updates `PlayerCard`, `CourtCard`, `SinglesCourtCard`, `QueuePanel`, and single-court win buttons.
- **`LiveCourtStatus.tsx` (`/watch`):**
  - `<WaitingQueueChips />`: Displays `formatDisplayName(player)` while keeping `player` in `aria-label` and `onToggleWatchPlayer`.
  - On-court team box: `.w-player-name` renders `formatDisplayName(player)` with `title={player}`.
- **`AnalyticsDashboard.tsx`:**
  - Table and card rows display `formatDisplayName(s.name)` with `title={s.name}`.

## What's Left to the Builder
- Unit test suite for `formatDisplayName` testing 1-word, 2-word, 3-word, 4-word, hyphenated, and whitespace-padded inputs.
- Verification that all existing unit, rules, and E2E suites pass with zero regressions.
