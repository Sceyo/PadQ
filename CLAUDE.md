@AGENTS.md

# PadQ — AI Agent Codebase Guide

## What This App Is

PadQ is a **real-time match queue manager** for singles and doubles paddle/racket sports. A host creates a session, adds players, and the app handles fair rotation. Viewers join via a room code (4-char uppercase) to watch live.

---

## Tech Stack

| Layer | Version | Notes |
|---|---|---|
| Next.js | 16.2.1 | App Router, `'use client'` on all interactive pages |
| React | 19.2.4 | Hooks only, no class components |
| Firebase | 12.11.0 | Firestore only — no Auth, no Storage |
| lucide-react | 1.7.0 | Icon library — import from `lucide-react` |
| qrcode.react | 4.2.0 | `QRCodeSVG` named export |
| Tailwind CSS | 4.2.2 | Rarely used — most styling is custom CSS |
| TypeScript | 5.x | Strict mode |

**Dev server**: `npm run dev` (with `--max-old-space-size=4096`)

---

## Project Structure

```
app/
  page.tsx                    # Homepage — game mode selector, room code entry
  layout.tsx
  globals.css
  queue/
    page.tsx                  # Main queue manager (host + viewer) — single large file
    QueueSystem.css           # All queue page styles (gear menu, setup, layout)
    lib/
      types.ts                # Shared types (PlayerStat, QueueMode, etc.)
      playerUtils.ts          # buildPlayerStats, generateSuggestions, shuffleArray
      doublesEngine.ts        # Doubles rotation algorithm (INIT/WINNERS/LOSERS)
      singleEngine.ts         # Singles king-of-court algorithm
    components/
      atoms/
        PlayerLabel.tsx       # Player name chip with rank badge
        RankBadge.tsx         # Bronze/Silver/Gold/Platinum/Diamond badge
        StreakBadge.tsx       # Win streak flame indicator
        AccessCodeModal.tsx   # Reusable PIN/code entry modal
      AccessGate/             # Wraps viewer content; checks PIN via useSessionAccess
      AnalyticsDashboard/     # Win rates, streaks, stats view
      Bracket/                # Tournament bracket (single + double elimination)
      CourtTabs/              # Multi-court tab switcher (host only)
      CourtView.tsx           # Viewer-mode live session display
      DoublesMatch/           # Doubles team assignment + match control
      LiveManagement/         # AddPlayerPanel + ManualQueuePanel (host live tools)
      PaddleStatusPanel/      # Doubles pool visualizer (W1/L1 pools)
      QueueTable/             # SinglesTable + DoublesTable upcoming matches
      ScoreBoard/             # Live score tracking with deuce logic
      SessionBar/             # Room code display + connection status
      ShareButton/            # (Legacy — replaced by GearMenu inline share)
      SinglesStatusPanel/     # Singles king + queue visualizer
      SmartSuggestions/       # AI-style hints (overuse, hot streak, imbalance)
      UserGuideModal/         # In-app how-to guide
      WinnerModal/            # Post-match winner celebration overlay
    context/
      CourtProvider.tsx
      useCourt.ts
    styles/
      globals.css
      layout.module.css
  watch/
    [sessionId]/
      page.tsx                # Viewer-only page — read-only live session view
hooks/
  useSession.ts               # Firebase session lifecycle (create, join, sync, listen)
  useQueue.ts                 # Local queue state + match suggestion logic
  useSessionAccess.ts         # Viewer PIN gate (checking → granted | needs-pin | error)
lib/
  firebase.ts                 # Firebase app + Firestore `db` init
  sessionService.ts           # ALL Firestore operations — UI never imports firebase directly
```

---

## Architecture: Data Flow

```
Host action (e.g. record match result)
  → page.tsx handler
    → useQueue.ts (local queue mutation, pure logic)
    → useSession.commitMatchResult() (Firestore transaction)
      → sessionService.updateQueueSafely()
        → Firestore `sessions/{sessionId}`
          → onSnapshot fires for ALL clients
            → useSession updates state
              → UI re-renders
```

Viewers subscribe to the same `onSnapshot` listener. They receive identical state but cannot write (no `hostToken` in memory).

---

## Key Files: Responsibilities

### `app/queue/page.tsx`
The central orchestrator. Contains:
- **Three render paths**: A (setup form), B (host active session), C (viewer joined)
- **`GearMenu` component** (defined inline at top): Settings dropdown with Go Live toggle, share/QR panel, Hard Reset, User Guide
- **`handleDoublesMatch`**: Records result, advances `paddleStateRef`, syncs to Firestore
- **`handleSinglesMatch`**: Records result, advances `singlesStateRef`, syncs to Firestore
- **`handleAddPlayerLive`**: Adds player to `w1` waiting in paddle engine, syncs players
- Derived state (`statsList`, `statsMap`, `suggestions`, `playAllSuggestion`) via `useMemo`
- Court group management via `addCourtToGroup`, `removeCourtFromGroup`, `loadCourtGroup`

### `lib/sessionService.ts`
Single source of truth for Firestore. Never import `firebase/firestore` directly in UI — always use this service.

Key exports:
- `createSession` / `loadSession` / `updateSession` / `deleteSession`
- `updateQueueSafely` — Firestore transaction for race-condition-safe queue writes
- `addHistoryEntry` — writes to `sessions/{id}/history` subcollection
- `subscribeToSession` / `subscribeToHistory` — real-time `onSnapshot` wrappers
- `saveHostToStorage` / `loadHostFromStorage` / `clearHostFromStorage` — localStorage helpers
- `addCourtToGroup` / `removeCourtFromGroup` / `loadCourtGroup` — multi-court localStorage
- `CourtEntry` interface — `{ sessionId, hostToken, gameMode, name }`

### `hooks/useSession.ts`
Manages session lifecycle. On mount, reads localStorage and resumes the host's session automatically. Exposes typed write actions (`startSession`, `commitMatchResult`, `syncField`).

### `hooks/useSessionAccess.ts`
Viewer PIN gate. Call at the top of any viewer component. States: `checking → granted | needs-pin | error`. Caches granted PINs in `sessionStorage`.

---

## Security Model

| Credential | Where stored | Purpose |
|---|---|---|
| `hostToken` | localStorage + Firestore field | Proves host identity on every write |
| `accessPin` | Firestore field (plain text) | Optional viewer gate (4-char uppercase) |
| Room code (`sessionId`) | URL + localStorage | Locates the session |

- Sessions auto-delete via **Firestore TTL policy** on `lastActiveAt` field (30-min idle).
- PIN is client-validated intentionally — sessions are ephemeral and Firestore rate-limits brute force.
- Viewers never receive `hostToken` — it's destructured out in `joinSession`.

---

## Queue Algorithms

### Singles — King of the Court (`singleEngine.ts`)
- King plays every match vs the next challenger in queue.
- King wins → stays on, streak increments, loser goes to back of queue.
- King loses → becomes challenger (goes to back), winner becomes new king.
- After **3 consecutive wins** (`SINGLES_MAX_WIN_STREAK = 3`), force rotation: king steps down, top two from queue play.
- `shouldForceRotation` checks **only streak**, not fatigue (fatigue always triggers for king — intentionally removed).

### Doubles — Paddle Engine (`doublesEngine.ts`)
Three-phase cycle per match:

| Phase | Who plays |
|---|---|
| `INIT` | Sequential groups of 4 from `allPlayers` until all seeded |
| `WINNERS` | Best 4 from `w1` pool (winners stay in w1) |
| `LOSERS` | Best 4 from `l1` pool (losers stay in l1) |

After `LOSERS`, cycle restarts at `WINNERS`. The `playedThisCycle` set ensures everyone plays before anyone plays twice.

**Scoring** (lower = better match): `PENALTY_REPEAT_PAIR=3`, `PENALTY_REPEAT_MATCH=5`, `PENALTY_FATIGUE=2`, `PENALTY_SKILL_IMBALANCE=1`.

`skillMap` — passed from `page.tsx` as `{ [playerName]: winRate }` derived from `statsMap`. Activates `PENALTY_SKILL_IMBALANCE`. Always pass it; default `{}` disables skill balancing.

`formTeams` — exhaustively evaluates all 3 splits of 4 players via `allPairings`, picks lowest penalty score. No shuffling needed.

INIT scaling: `Math.ceil(allPlayers.length / 4)` matches, not a hardcoded 2.

---

## Multi-Court System

Each court is an independent Firestore session. The host device tracks all courts in `localStorage` under key `padq_court_group` (array of `CourtEntry`).

Court switch mechanism: call `saveHostToStorage(targetSessionId, targetHostToken, targetGameMode)` then `window.location.reload()`. The mount effect in `useSession` resumes the target court automatically.

`CourtTabs` component renders only when `courts.length >= 2` OR `canManage` is true. Renders nothing below that threshold.

---

## Firestore Schema

```
sessions/{sessionId}           ← TTL field: lastActiveAt (30-min policy)
  hostToken: string            ← UUID, required on every write
  gameMode: 'singles'|'doubles'
  queueMode: 'default'|'tournament'|'playall'
  elimType: 'single'|'double'
  players: string[]
  queue: string[]
  playAllRel: Record<string, number>
  tournamentMatches: TournamentMatch[]
  tournamentActive: boolean
  tournamentWinner: string|null
  liveScore: LiveScoreState|null
  isLive: boolean              ← host must explicitly set true to allow viewers
  accessPin: string|null       ← null = open, string = PIN required
  courtName: string            ← display name for CourtTabs
  createdAt, updatedAt, lastActiveAt: Timestamp

sessions/{sessionId}/history/{auto-id}
  id, mode, players, winner, score?, timestamp, hostToken
```

---

## Styling Conventions

- **Global CSS variables**: `--accent`, `--btn`, `--btn-hover`, `--border`, `--txt-2`, `--txt-3`, `--r-sm`
- **Dark mode**: toggled by adding `body.dark-mode` class. All dark overrides use `body.dark-mode .className { ... }`.
- **CSS Modules** (`.module.css`) for all components under `components/`.
- **`QueueSystem.css`** for all queue page-level styles (layout, gear menu, setup form, match section, etc.).
- **No Tailwind in queue page** — only custom CSS.

---

## Common Gotchas

1. **Never call Firebase directly** — always go through `lib/sessionService.ts`.
2. **`useSession` fields** come from Firestore snapshots — local-only UI state lives in `page.tsx` state, not `session.*`.
3. **`paddleStateRef` / `singlesStateRef`** — engine state is in refs, not React state (avoids stale closures in match handlers). `setPaddleStateUI` / `setSinglesStateUI` are separate for display only.
4. **`addDoc` rejects `undefined`** — always build clean objects before writing to Firestore history. `sessionService.addHistoryEntry` handles this.
5. **`Set` is not JSON-serializable** — `playedThisCycle` in `PaddleState` is a `Set<string>`. Never try to store it directly in Firestore; it stays in the ref.
6. **Court group is localStorage-only** — not in Firestore, not in session state. Load with `loadCourtGroup()` on mount.
7. **`ShareButton` component is legacy** — it still exists but is not rendered. Share UI lives inside `GearMenu` in `page.tsx`.
8. **Viewer PIN cache** — `sessionStorage`, not `localStorage`. Cleared when the browser tab closes, not on page reload.
