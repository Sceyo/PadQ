@AGENTS.md

# PadQ — AI Agent Codebase Guide

## Engineering Guidelines & Standards
All development, code reviews, debugging, architectural design, and operational checks in this codebase strictly adhere to the project standards in [`.claude/guidelines/`](.claude/guidelines/):
- **[Architecture & System Design](.claude/guidelines/architecture.md)**: Simplicity first, reversible two-way doors, strict boundary isolation, honest data ownership.
- **[Observability & Reliability](.claude/guidelines/observability-reliability.md)**: Structured logging, RED/USE metrics, network timeouts, bounded retries with jitter, idempotency, graceful degradation.
- **[Performance](.claude/guidelines/performance.md)**: Measure baseline/target before optimizing, algorithmic efficiency, bounded allocations, and Firebase Spark ($0) budget awareness.
- **[Code Review](.claude/guidelines/code-review.md)**: Prioritized review (Correctness → Security → Design → Tests → Operability → Performance → Readability) with labeled comments (`[blocker]`, `[suggestion]`, `[question]`, `[nit]`, `[praise]`).
- **[Debugging](.claude/guidelines/debugging.md)**: Reproduce first, hypothesize then falsify, root cause before fixing, minimal fix, and regression test prevention.

## What This App Is

PadQ is a **real-time match queue and court manager** for singles and doubles paddle/racket sports (1–3 courts, up to 30 players). A host creates a session, imports or checks in players, and the app handles fair rotation across courts. Spectators join via a 6-character unambiguous room code or QR code to watch live court assignments, waiting queue ETAs, turn alerts, and session standings.

---

## Tech Stack

| Layer | Version | Notes |
|---|---|---|
| Next.js | 16.4.3 | App Router (Turbopack), `'use client'` on interactive pages |
| React | 19.2.4 | Hooks only, functional components |
| Firebase | 12.19.0 | Cloud Firestore + Anonymous Authentication + App Check (reCAPTCHA Enterprise) |
| lucide-react | 1.7.0 | Icon library — import from `lucide-react` |
| qrcode.react | 4.2.0 | `QRCodeSVG` named export |
| Tailwind CSS | 4.2.2 | Minimal utility usage — primary styling is custom CSS & CSS Modules |
| TypeScript | 5.x | Strict mode (`npx tsc --noEmit`) |
| Testing | Vitest 4.1.11 + Playwright | 513 unit/component tests, 39 Firestore rules tests, 39 E2E browser tests |

**Dev server**: `npm run dev` (with `--max-old-space-size=4096`)

---

## Project Structure

```
app/
  page.tsx                    # Homepage — game mode selector, room code / QR entry
  layout.tsx                  # Root layout mounting AuthResilienceBanner
  error.tsx                   # App Router error boundary
  not-found.tsx               # Custom 404 page
  globals.css
  Homepage.css                # Landing page styling
  privacy/                    # Public Privacy & Data Retention policy page
  queue/
    page.tsx                  # Main queue orchestrator (setup + host active session + viewer)
    QueueSystem.css           # Queue page styles
    lib/
      types.ts                # Shared types (PlayerStat, QueueMode, HistoryItem, etc.)
      releaseConfig.ts        # V1 release boundary config (max 30 players, 3 courts, mobileFirstShell)
      nameFormatter.ts        # Pure display-layer compact name formatter (formatDisplayName)
      pasteParser.ts          # Smart Reclub / numbered / bulleted roster paste parser
      checkInState.ts         # Two-tier pre-session check-in & expected late arrivals state
      playerUtils.ts          # buildPlayerStats (4-tier tiebreakers: Wins, Win%, Diff, OWP), flipHistoryEntryWinner
      doublesEngine.ts        # Doubles rotation algorithm (INIT/WINNERS/LOSERS + formTeams)
      singleEngine.ts         # Singles King-of-the-Court algorithm (3-win streak rotation cap)
      singlesPoolEngine.ts    # Singles Pool-Rotation algorithm (single-court default: INIT/WINNERS/LOSERS)
      multiCourtResult.ts     # Multi-court match completion planner (team anti-repeat, skill balance, singles 3-win cap, non-blocking partner leapfrog)
      queueTransitions.ts     # Accounted player invariants (accountPlayers, replaceCalledPlayer, reorderWaitingPlayer)
      etaEngine.ts            # Deterministic queue wait-time calculator (calculatePlayerEta, formatEtaLabel)
      turnAlert.ts            # Spectator turn alert state transition detector (Web Audio chime + vibrate)
      viewModels.ts           # View-model mappers for SingleCourtScreen, MultiCourtScreen, QueuePanel
    components/
      atoms/
        PlayerLabel.tsx       # Compact player name chip (formatDisplayName + raw title tooltip + Streak/Rank badges)
        RankBadge.tsx         # Bronze/Silver/Gold/Platinum/Diamond badge
        StreakBadge.tsx       # Win streak flame indicator
      AppShell/               # Mobile-first application shell (Header, Queue/Stats tabs, HostTools trigger, GearMenu)
      SingleCourtScreen/      # Single-court active match scoreboard, deuce controls, and QueuePanel
      MultiCourtScreen/       # Multi-court grid (1–3 courts), Match Scores toggle, and QueuePanel
      CourtCard/              # Doubles court card with Team 1/2 containers, MM:SS elapsed timer, and TTS voice callout
      SinglesCourtCard/       # Singles court card for multi-court singles
      CourtScoreModal/        # 1-tap score presets (11–9, 11–7, etc.) & custom score entry modal
      QueuePanel/             # Accordion queue panel (UP NEXT, collapsible WAITING with ETAs, collapsible ON BREAK)
      HostToolsSheet/         # Slide-up host sheet (Expected Late Arrivals 1-tap tray, Add Player, Manage Queue, Set Partners, On Break)
      LiveManagement/         # AddPlayerPanel, ManualQueuePanel, PartnerPanel (Option 2 Global Pairing UI)
      AnalyticsDashboard/     # 4-tier standings table, match history with Flip Winner, and RecapModal trigger
      RecapCard/              # Shareable Session Standings & Individual Player Spotlight stat cards (RecapModal)
      SetupView/              # Session setup: court count, Smart Paste, Two-Tier Check-In, Saved Roster
      GearMenu/               # Settings dropdown: Go Live, Share/QR, Undo Last Match, End Session & Delete Data
      ScoreRow/               # Score row atom for single-court scoreboard
      PlayerMenu/             # Action sheet for on-court/waiting player actions (Replace, Move up/down, Break, Remove)
      ReplaceDialog/          # Player substitution modal
      EditTeamsDialog/        # On-court team swap modal
  watch/
    [sessionId]/
      page.tsx                # Spectator live page (LiveCourtStatus, Turn Alerts, History, Standings, RecapModal)
      LiveCourtStatus.tsx     # Court 1–3 tabs, live matchups, and WaitingQueueChips with ETAs & Turn Alert toggles
components/
  AuthResilience/             # Global fatal Auth/Firestore assertion recovery overlay
hooks/
  useSession.ts               # Firebase session lifecycle (create, load, subscribe, transactional commits, heartbeat)
  useQueue.ts                 # Local queue state helper
  useMatchFlow.ts             # Single-court score & match confirmation state machine
lib/
  firebase.ts                 # Firebase App, Anonymous Auth, Firestore, App Check, and emulator wiring
  authResilience.ts           # Global unhandledrejection / fatal Firestore assertion detector & silent recovery
  sessionService.ts           # ALL Firestore & localStorage operations — UI never imports firebase/firestore directly
docs/                         # Architecture, ADRs, specs, implementation plans, release gates, and security audits
tests/                        # 64 Vitest test files + 13 Playwright E2E spec files (`tests/e2e/*.pw.ts`)
```

---

## Architecture: Data Flow

```
Host action (e.g. record match result, flip winner, check in late arrival)
  → page.tsx handler
    → Domain engine transition (doublesEngine / singleEngine / singlesPoolEngine / multiCourtResult)
    → useSession transactional write (commitMatchResult / commitCourtResult / replaceHistoryItem)
      → sessionService.ts (Firestore runTransaction with revision +1 & commandId idempotency)
        → Firestore `sessions/{sessionId}` + `sessions/{sessionId}/history/{commandId}`
          → onSnapshot fires for host and all `/watch/[sessionId]` spectators
            → useSession / watch page updates state
              → UI re-renders with compact display names (formatDisplayName)
```

---

## Security & Integrity Model

| Mechanism | Implementation | Purpose |
|---|---|---|
| **Host Identity (`hostUid`)** | Firebase Anonymous Auth (`request.auth.uid == resource.data.hostUid`) | Cryptographically binds session write/delete ownership to the creator's auth UID |
| **Room Code (`sessionId`)** | 6-char unambiguous uppercase (`^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$`) | Collision-checked on creation; `allow list: if false` prevents room enumeration |
| **Pre-Live Privacy (`isLive`)** | `allow get` requires `isDocOwner()` OR `resource.data.isLive == true` | Spectators cannot read a room or its history until the host explicitly clicks **Go Live** |
| **Optimistic Concurrency (`revision`)** | Monotonic integer incremented (`revision + 1`) on every state/match transaction | Prevents lost updates and serializes simultaneous multi-court match completions |
| **Idempotent History (`commandId`)** | UUID v4 document ID in `sessions/{id}/history/{commandId}` verified via `getAfter()` | Guarantees every history write is atomically paired with a parent revision increment |
| **Partition & Roster Invariants** | `validPlayerRoster`, `validPlayerSubset`, `validCourts` in `firestore.rules` | Enforces max 30 unique players, max 3 courts, no duplicate players across courts, and sealed V1 modes |
| **Inactivity Lock & Heartbeat** | `isSessionActive()` (30m window) + `isHeartbeatUpdate()` bypass | Locks stale rooms after 30m of inactivity while allowing the host's tab-focus heartbeat to un-stale the room |
| **Display-Only Name Formatting** | `formatDisplayName` in `app/queue/lib/nameFormatter.ts` | Formats `"Anna Leigh Waters"` → `"A.L. Waters"` strictly at render time; raw names are never mutated in state or Firestore |

---

## Queue & Matchmaking Algorithms

### 1. Singles — Pool Rotation (`singlesPoolEngine.ts`) & King of the Court (`singleEngine.ts`)
- **Single-Court Default (Pool Rotation):** Cycles `INIT → WINNERS → LOSERS` using `w1` and `l1` pools (capped at `MAX_POOL_SIZE = 8` with overflow into `waitingQueue`), scoring candidate pairs against repeat-match (`PENALTY_REPEAT_MATCH = 5`), fatigue (`PENALTY_FATIGUE = 2`), and skill imbalance (`PENALTY_SKILL_IMBALANCE = 1`).
- **King of the Court (Single-Court Option & Multi-Court Singles):** Winner stays on court until defeated or reaching **3 consecutive wins** (`SINGLES_MAX_WIN_STREAK = 3` / `MULTI_COURT_SINGLES_MAX_STREAK = 3`), at which point both players rotate off so the waiting queue advances fairly.

### 2. Doubles — Paddle Engine (`doublesEngine.ts`) & Multi-Court Planner (`multiCourtResult.ts`)
- **Single-Court Doubles:** Cycles `INIT → WINNERS → LOSERS` across `w1` and `l1` pools. `formTeams` evaluates all 3 possible pairings of 4 players and picks the split with the lowest penalty (`PENALTY_REPEAT_PAIR = 3`, `PENALTY_REPEAT_MATCH = 5`, `PENALTY_FATIGUE = 2`, `PENALTY_SKILL_IMBALANCE = 1`).
- **Multi-Court Doubles (`planMultiCourtResult`):**
  - Interleaves finished court teams before returning them to the shared queue so unlocked partners rotate naturally.
  - Evaluates candidate 4-player groups using live match history (`recentPartners`, `recentOpponents`) and `buildNumericSkillMap` (mapping unplayed bracket tags to `25/50/75` and played players to live `winRate`).
  - **Global Asynchronous Partner Pairing (Option 2):** Locked partners can be paired across courts or queue. If one partner is still playing on another court, the waiting partner holds their spot in line while solo players leapfrog past to fill open courts (zero court starvation), uniting the pair on the next available court once both are free.

### 3. Standings & Tiebreakers (`playerUtils.ts`)
4-tier deterministic sorting in `buildPlayerStats`:
1. **Wins** (descending)
2. **Win Rate %** (descending)
3. **Point Differential (`+/-`)** (descending)
4. **Matchup Strength / Opponent Win % (`OWP`)** (descending)

---

## Common Gotchas

1. **Never import `firebase/firestore` in UI components** — all persistence goes through `lib/sessionService.ts`.
2. **Never modify `firestore.rules` directly in the main agent** — always delegate rules changes to the `firestore-rules-author` subagent and verify with `npm run test:rules`.
3. **Never mutate raw player names with `formatDisplayName`** — `formatDisplayName` is strictly for JSX text rendering (`PlayerLabel`, spectator chips, leaderboard cells). Keep raw names in state, Firestore, `title`, `aria-label`, and action callbacks.
4. **Mobile touch target contract** — all interactive buttons on mobile viewports (`390px`) must maintain `>= 44px` height, and inputs/selects must maintain `>= 16px` font size to prevent iOS auto-zoom.
5. **Firebase Emulator commands on Windows** — pass Playwright flags inside the quoted script string: `npx.cmd firebase --config firebase.e2e.json emulators:exec --only auth,firestore "npx.cmd playwright test"`.
