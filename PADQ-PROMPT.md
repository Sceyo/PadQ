# PADQ System — Project Documentation

## Overview

**PADQ** (Paddle Queue) is a real-time match queue management system for sports/games (padel, tennis, badminton, etc.). It organizes singles or doubles matches with smart queue algorithms, tracks player stats, supports tournament brackets, and syncs across all connected clients via Firebase Firestore.

---

## Project Structure

```
PadQ/
├── app/                          # Next.js 16 App Router
│   ├── page.tsx                  # Homepage (entry point)
│   ├── Homepage.tsx              # Homepage with mode selection cards
│   ├── Homepage.css              # Homepage styles (~180 lines)
│   ├── globals.css               # Tailwind/global styles
│   ├── layout.tsx                # Root layout (Geist fonts)
│   ├── queue/
│   │   ├── page.tsx              # Queue system (host control panel) — LARGE (~32k tokens)
│   │   └── QueueSystem.css       # All queue/tournament/scoreboard styles (~2435 lines)
│   ├── watch/
│   │   └── [sessionId]/
│   │       ├── page.tsx          # Read-only spectator page
│   │       └── watch.css         # Watch page styles (~602 lines)
│   └── components/
│       ├── SessionQR.tsx          # QR code modal for sharing sessions
│       └── SessionQR.css         # QR modal styles
├── lib/
│   ├── firebase.ts               # Firebase initialization
│   └── sessionService.ts        # All Firestore CRUD operations (~391 lines)
├── hooks/
│   ├── useQueue.ts              # Queue state logic + Play-All algorithm (~378 lines)
│   └── useSession.ts            # Firebase bridge hook (~376 lines)
├── public/
│   └── PADQ.png                 # Logo image
├── pages/                       # (empty / legacy)
├── firebase.json
├── firestore.rules              # Firestore security rules
├── firestore.indexes.json
├── .env.local                   # Firebase config (not committed)
├── package.json
├── next.config.ts
├── tsconfig.json
└── AGENTS.md / CLAUDE.md        # Project instructions
```

---

## Core Files

### 1. `app/page.tsx` + `app/Homepage.tsx` + `app/Homepage.css`

**Purpose:** Landing page. Three mode cards (Singles, Doubles, Watch).

**Key features:**
- `WatchModal` component with two tabs: **Scan QR** (BarcodeDetector API) and **Enter Code** (manual 4-6 char code)
- Uses `loadSession()` from `sessionService.ts` to validate room codes
- Routes to `/queue?mode=singles|doubles` on card click
- Animated ambient orbs, dark theme, responsive design
- Google Fonts: Bebas Neue (headings) + Inter (body)

**CSS classes used:** `.homepage`, `.hp-card--singles/doubles/watch`, `.watch-modal`, `.watch-overlay`, `.watch-video`, `.watch-scan-frame`, `.scan-line`, `.watch-code-input`, `.watch-join-btn`, `.hp-pill`, `.hp-orb`

**Images:** `/PADQ.png` (logo)

---

### 2. `app/queue/page.tsx` + `app/queue/QueueSystem.css`

**Purpose:** Main host control panel. All write operations to Firestore originate here.

**Key features:**
- **Setup Phase:** Add 5-24 players, select game mode (singles/doubles), choose queue mode, elimination type
- **Queue Modes:**
  - `default` — winners move to back, losers to front
  - `randomize` — shuffle entire queue after each match
  - `tournament` — knockout bracket (single/double elimination, Grand Final)
  - `playall` — prevents repeat pairings until all combinations exhausted
- **Match UI:** Select winner (singles) or assign teams + select winner (doubles)
- **Scoreboard:** Point-based scoring with configurable limit (e.g., first to 11), deuce support, live score sync to Firebase (`liveScore` field)
- **Tournament Bracket:** Uses `brackets-manager` library; Winners/Losers/Grand Final brackets
- **Player Stats:** Win rate, rank tiers (Bronze/Silver/Gold/Platinum/Diamond), win streaks
- **Match History:** Timestamped results with score, toggle show/hide
- **Session Sharing:** Go Live button, QR code modal (`SessionQR`), room code display
- **Host Controls:** Dark mode toggle, Hard Reset (full wipe), Clear History, Help Guide modal
- **Real-time sync:** All changes write to Firestore via `useSession` hook; `onSnapshot` delivers updates to host and all viewers simultaneously

**CSS classes:** 2000+ lines covering: `.queue-system`, `.setup-page`, `.game-view`, `.scoreboard-wrap`, `.score-side--a/b`, `.match-section`, `.pairing-table`, `.bracket-container`, `.bracket-match`, `.paddle-status`, `.share-trigger--is-live`, `.session-bar`, `.viewer-mode`, `.guide-modal`, `.paddle-pool`, `.on-court-label`, `.hard-reset-btn`, `.help-btn`, and many more

---

### 3. `app/watch/[sessionId]/page.tsx` + `watch.css`

**Purpose:** Read-only spectator page. Connects via room code or QR scan.

**Key features:**
- Validates session existence before rendering (guards against invalid codes)
- Shows "Session Not Live Yet" until host clicks Go Live
- Subscribes to Firestore via `subscribeToSession` + `subscribeToHistory`
- **Live Score Hero:** When host has scoring active (`liveScore.active = true`), displays a large hero scoreboard
- **Tournament View:** Read-only bracket display, no controls
- **Queue View:** Current match + upcoming matches table
- **Stats:** Win/loss table with rank badges and streak indicators
- **History:** Collapsible match history panel
- All interactive elements disabled; zero write access to Firestore

**CSS classes:** `.watch-shell`, `.w-topbar`, `.w-live-score-hero`, `.w-live-score-board`, `.w-live-side`, `.w-live-score-num`, `.w-bracket-match`, `.w-stats-table`, `.w-history-list`, `.w-not-live-icon`

---

### 4. `app/components/SessionQR.tsx` + `SessionQR.css`

**Purpose:** QR code modal for the host to share the session URL.

**Features:**
- Renders QR code via `qrcode.react` library (`QRCodeSVG`)
- Shows room code prominently
- Copy Link button (uses `navigator.clipboard`)
- Open Watch Page link
- Dark-themed modal matching the app's aesthetic

**CSS classes:** `.sqr-trigger`, `.sqr-overlay`, `.sqr-modal`, `.sqr-qr-wrap`, `.sqr-room-code`, `.sqr-action-btn`

---

### 5. `lib/firebase.ts`

**Purpose:** Single Firebase app initialization.

**Key details:**
- Uses Firebase v12 (modular SDK)
- `experimentalForceLongPolling: true` — works around WebSocket issues on some networks/VPNs/proxies
- `cacheSizeBytes: CACHE_SIZE_UNLIMITED` — avoids Firestore cache eviction
- Config from `.env.local` environment variables

---

### 6. `lib/sessionService.ts`

**Purpose:** Centralized Firestore operations service layer.

**Key exports:**
- `SessionDoc` interface — shape of a session in Firestore
- `createSession()` — generates room code + host token, writes to Firestore
- `loadSession()` — one-time read, returns null if not found
- `updateSession()` — partial update, resets TTL (`lastActiveAt`)
- `updateQueueSafely()` — **transactional** queue update (prevents race conditions)
- `addHistoryEntry()` — appends to `sessions/{id}/history` subcollection
- `clearHistory()` — batch deletes history subcollection
- `subscribeToSession()` — real-time `onSnapshot` listener
- `subscribeToHistory()` — real-time history subcollection listener
- `touchSession()` — lightweight TTL reset heartbeat
- `deleteSession()` — permanent session deletion
- localStorage helpers: `saveHostToStorage`, `loadHostFromStorage`, `clearHostFromStorage`

**Firestore TTL:** Sessions auto-delete after 30 minutes of inactivity via `lastActiveAt` TTL policy in Firebase Console.

---

### 7. `hooks/useQueue.ts`

**Purpose:** Pure queue algorithm logic (no Firebase).

**Key exports:**
- `useQueue()` hook — manages `gameMode`, `players`, `queue`, `playAllRel` state
- `recordDoublesRelationships()` — mutates relationship maps after a doubles match
- `scoreTeamSplit()` — scores a candidate team split (lower = fresher/novel)
- `suggestNextDoublesMatch()` — Play-All lookahead algorithm (anchor + pool lookahead)
- `recordSinglesRelationships()` / `suggestNextSinglesMatch()` — singles equivalents
- Play-All prevents same pairing until all combinations exhausted

**Storage:** `sessionStorage` (not localStorage) — survives page refresh but clears when tab closes.

---

### 8. `hooks/useSession.ts`

**Purpose:** Bridge between Firestore and the UI.

**Key exports:**
- `useSession()` hook — returns combined state + actions
- State: `sessionId`, `hostToken`, `isHost`, `isConnected`, `isSaving`, `isReconnecting`, `isExpired`, `players`, `queue`, `playAllRel`, `queueMode`, `elimType`, `tournamentMatches`, `tournamentActive`, `tournamentWinner`, `matchHistory`, `liveScore`, `isLive`
- Actions: `startSession`, `joinSession`, `endSession`, `commitMatchResult`, `syncField`, `clearMatchHistory`
- Mount resume: checks localStorage for `hostToken`, resumes session if found
- `attachListeners()` — sets up `onSnapshot` for session doc + history subcollection

---

## CSS Summary

### Homepage CSS (`Homepage.css` — ~180 lines)
Ambient orbs, mode cards (singles=red, doubles=cyan, watch=purple), watch modal with QR scan UI, feature pills.

### Queue System CSS (`QueueSystem.css` — ~2435 lines)
Light/dark mode via CSS variables, scoreboard (team A/B display with +/- buttons), tournament bracket styling, Play-All paddle status panel, share popover (QR tab + Code tab), Go Live button states, viewer mode overlays, guide/help modal, mobile responsive breakpoints at 640px and 860px.

### Watch CSS (`watch.css` — ~602 lines)
Dark theme only (fixed #0b0b18 background), live score hero (large Bebas Neue numbers), bracket display, stats table, history list.

### SessionQR CSS (`SessionQR.css` — ~111 lines)
Dark modal (#13131f), QR canvas, room code display, copy/open action buttons.

---

## Images

| File | Description |
|------|-------------|
| `public/PADQ.png` | Logo (used in Homepage header) |
| `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg` | Default Next.js placeholder SVGs |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.2.1 (App Router, `'use client'` components) |
| Language | TypeScript |
| UI | React 19.2.4, Lucide React icons |
| Styling | Custom CSS (CSS variables, no utility framework for main app) + Tailwind 4 (globals only) |
| Backend | Firebase Firestore (real-time database) |
| Auth | None (host identified by `hostToken` in localStorage + Firestore rules) |
| Tournament | `brackets-manager` 1.9.1 + `brackets-memory-db` |
| QR Codes | `qrcode.react` 4.2.0 |
| Fonts | Google Fonts — Bebas Neue (headings), Inter (body) |

---

## Current State

- **Git status:** 4 modified files staged/unstaged in working tree
- **Last commit:** `d04a790 PADQ V1`
- **Active development:** In progress — files `app/Homepage.css`, `app/page.tsx`, `app/queue/QueueSystem.css`, `app/queue/page.tsx` have uncommitted changes

---

## Efficiency Notes

- **Firestore reads:** Optimized — history subscription only attaches when viewer opens history panel; bracket-manager runs in-memory (not Firestore)
- **Race conditions:** Handled via `updateQueueSafely()` (Firestore transaction) for all queue mutations
- **TTL:** 30-minute auto-expiry on sessions — no manual cleanup needed
- **Long polling:** `experimentalForceLongPolling: true` — reliable across VPNs/proxies at slight efficiency cost vs WebSockets
- **No unnecessary re-renders:** `useCallback` on all session actions; `useMemo` on derived stats in watch page
- **CSS bundle:** Single large `QueueSystem.css` (~2435 lines) — consider code-splitting if bundle size becomes an issue
