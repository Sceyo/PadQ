# Pre-Session Check-Ins, Engine Parity, Spectator UX & Live Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver all 10 high-impact internal improvements for PAD-Q—covering Pre-Session Check-Ins ("Not Yet Here" vs "Checked In"), Smart Chat/Reclub Paste Parsing, Multi-Court Doubles Team Anti-Repeat Balancing, Multi-Court Singles 3-Win Streak Cap, Partner Lock Seeding Fix, Full Spectator `/watch` Queue + ETA Badges, Opt-In Turn Audio/Vibration Alerts, Retroactive Match History Winner/Score Correction, Live Court Elapsed Timers + TTS Voice Callouts, and Individual Player Stat Cards—while strictly preserving the $0 Firebase Spark / Vercel Hobby contract and closed `firestore.rules` schema.

**Architecture:** 
- **Phase 1 (Setup & Core Engine Parity — Tasks 1–7):** Decouples pure logic into deterministic utility modules (`pasteParser.ts`, `checkInState.ts`) with `localStorage` draft persistence (Approach A). Only physically arrived (`checkedIn`) players are written to Firestore on session start; un-arrived RSVPs move into a 1-tap Late Arrivals tray in Host Tools. Rotational fairness fixes wire directly into `doublesEngine.ts`, `multiCourtResult.ts`, and `page.tsx`.
- **Phase 2 (Spectator `/watch` Experience — Tasks 8–9):** Expands `LiveCourtStatus.tsx` to display the full numbered waiting queue with `formatEtaLabel` badges from `etaEngine.ts`, and adds an opt-in "Tap Your Name" turn alert (`turnAlert.ts`) that triggers Web Audio chime and `navigator.vibrate` when a player's name moves onto a court or `On Deck`.
- **Phase 3 (Host Live Polish & Sharing — Tasks 10–13):** Adds client-side court elapsed timers (`mm:ss`) and native `window.speechSynthesis` callouts to `CourtCard.tsx` (keyed by match signature in `sessionStorage` so `validCourt` in `firestore.rules` remains untouched), adds host match history winner-flip/score correction via atomic delete+create history transactions, and adds a 3rd `'player'` spotlight variant to `RecapModal.tsx` / `RecapCard.tsx`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Firebase Firestore 12, Vitest 4, `html-to-image`, Web Speech & Web Audio APIs, Lucide React icons.

**Spec:** `padq_vs_pickleq_algorithms_and_scoping.md` and `pickleq_deep_dive_analysis.md`.

## Global Constraints

- **Platform Floor:** Node.js 20+, React 19, Next.js 16.4.3.
- **Closed Firestore Schema:** Zero modifications to `firestore.rules`. Specifically:
  - `validSession` keys remain unchanged.
  - `validCourt` strictly enforces `court.keys().hasOnly(['id', 'name', 'onCourt'])` (elapsed timers must use client-side storage keyed by court + player lineup, never mutating `CourtSlot` keys).
  - `history/{entryId}` enforces `allow update: if false; allow delete: if parentOwned(); allow create: if ...` (history corrections must use local state + atomic delete-old / create-new revisioned transaction when connected).
- **Roster Bounds:** 5 to 30 players, 1 to 3 courts, max 60 characters per sanitized player name.
- **TDD Requirement:** Strict red-green-refactor loop. Every task begins with a failing unit or component test before production code is touched.
- **Zero Regressions:** All 455+ existing Vitest tests must continue passing at every commit.

## Review Focus

1. **Paste Parser Tag Bleed:** Chat noise like `1. Juan Dela Cruz (paid via gcash 500)` or `[PAID] Maria - 09171234567` could leak financial notes or phone numbers into the display name. Expectation: Parser sanitizes strictly to clean player names `Juan Dela Cruz` and `Maria`.
2. **Ghost Player Court Seeding:** Starting a session with unarrived players in the active queue places phantom players on court. Expectation: `minPlayers` gate and initial court seeding strictly consume `checkedIn` players; `expected` players remain in the offline late-arrivals tray.
3. **Permanent Duo Separation in Team Splitting:** Running `formTeams` on an unlocked court could separate a locked pair if the solver treats all 4 as free agents. Expectation: `balanceSelectedMatch` preserves locked partner indivisibility unconditionally.
4. **Closed `CourtSlot` Schema Violation:** Adding a `startedAt` field onto a `CourtSlot` object synced to Firestore would fail `validCourt` (`court.keys().hasOnly(['id', 'name', 'onCourt'])`). Expectation: Court elapsed timer derives and persists start timestamps in client storage keyed by `${court.id}:${court.onCourt.join('|')}`.
5. **Turn Alert Spam on Unrelated Court Changes:** On a 3-court session, Court 2 finishing should not chime a player who is still #9 in the queue or already playing on Court 1. Expectation: `shouldTriggerTurnAlert` fires only on the transition where the subscribed player newly enters a court slot or moves into the `On Deck` (`nextPlayers`) slice.

---

## Phase 1: Setup Intake, Check-Ins, Late Arrivals & Core Engine Parity

### Task 1: Smart Text & Reclub List Parser Utility (`app/queue/lib/pasteParser.ts`)

**Files:**
- Create: `app/queue/lib/pasteParser.ts`
- Test: `tests/pasteParser.test.ts`

**Interfaces:**
- Consumes: Nothing (pure utility).
- Produces:
  ```ts
  export interface ParsedPlayerEntry {
    name: string;
    rating?: number;
    duprId?: string;
    raw: string;
  }
  export function sanitizePlayerName(raw: string): string;
  export function parsePlayerListPaste(rawText: string): ParsedPlayerEntry[];
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/pasteParser.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parsePlayerListPaste, sanitizePlayerName } from '../app/queue/lib/pasteParser';

describe('pasteParser', () => {
  it('sanitizes noisy chat and Reclub exports into clean names', () => {
    const raw = `
      1. Carlos Alcaraz (PAID)
      2) Jannik Sinner [GCash]
      • Rafael Nadal - 09171234567
      [4] Novak Djokovic | rating=5.0
      Daniil Medvedev, Alexander Zverev
    `;
    const result = parsePlayerListPaste(raw);
    expect(result.map(p => p.name)).toEqual([
      'Carlos Alcaraz',
      'Jannik Sinner',
      'Rafael Nadal',
      'Novak Djokovic',
      'Daniil Medvedev',
      'Alexander Zverev',
    ]);
    expect(result[3].rating).toBe(5.0);
  });

  it('rejects empty lines, header lines, clamps to 60 chars, and deduplicates case-insensitively', () => {
    const raw = `
      Players list:
      1. Carlos Alcaraz
      2. carlos alcaraz
      Waitlist:
      3. Iga Swiatek
    `;
    const result = parsePlayerListPaste(raw);
    expect(result.map(p => p.name)).toEqual(['Carlos Alcaraz', 'Iga Swiatek']);
    expect(sanitizePlayerName('A'.repeat(80)).length).toBe(60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/pasteParser.test.ts --run`
Expected: FAIL with "Cannot find module '../app/queue/lib/pasteParser'"

- [ ] **Step 3: Implement `parsePlayerListPaste` and `sanitizePlayerName` in `app/queue/lib/pasteParser.ts`**

Implement regex sanitization rules:
- Split on newlines first; if a line has no pipe metadata and contains commas, split on commas.
- Strip numbering prefixes (`/^\s*(?:\[\d+\]|\d+[\.\)\-:]|\#\d+|\-\s*|•\s*|\*\s*)/i`).
- Strip payment & status tags (`/\b(?:paid|unpaid|gcash|cash|guest|sub|waitlist|via)\b/gi` and empty parentheses/brackets).
- Strip phone numbers (`/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g`).
- Skip section headers (`/^(?:players?\s*list|rsvp|waitlist|confirmed|attendees)\s*:?\s*$/i`).
- Extract pipe metadata (`/\|\s*rating\s*=\s*([0-9.]+)/i`, `/\|\s*duprId\s*=\s*([a-zA-Z0-9]+)/i`).
- Trim, collapse whitespace, clamp to 60 chars, and deduplicate case-insensitively.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/pasteParser.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/queue/lib/pasteParser.ts tests/pasteParser.test.ts
git commit -m "feat(queue): add smart text and Reclub paste parser utility"
```

---

### Task 2: Multi-Court Doubles Team Splitting & Anti-Repeat Balancing

**Files:**
- Modify: `app/queue/lib/doublesEngine.ts:650-701`
- Modify: `app/queue/lib/multiCourtResult.ts:114-140`
- Test: `tests/doublesEngine.test.ts`
- Test: `tests/multiCourtEngine.test.ts`

**Interfaces:**
- Consumes: `formTeams` from `app/queue/lib/doublesEngine.ts`.
- Produces:
  ```ts
  export interface MultiCourtRotateOptions {
    recentPairs?: string[];
    recentMatches?: string[];
    skillMap?: Record<string, number>;
  }
  export function balanceSelectedMatch(
    selectedPlayers: string[],
    lockedPairs: LockedPartnerPair[],
    recentPairs?: string[],
    recentMatches?: string[],
    lastMatchPlayers?: Set<string>,
    skillMap?: Record<string, number>,
  ): string[];
  export function rotateMultiCourtDoubles(
    waitingPlayers: string[],
    finishedPlayers: string[],
    lockedPairs: LockedPartnerPair[],
    options?: MultiCourtRotateOptions,
  ): PartnerAwareSelection;
  ```

- [ ] **Step 1: Write the failing test**

Add unit test in `tests/doublesEngine.test.ts`:
```ts
it('balances 4 unlocked players using anti-repeat partner history while preserving locked pairs', () => {
  const players = ['P1', 'P2', 'P3', 'P4'];
  const recentPairs = ['P1+P2']; // P1 and P2 just partnered
  const balanced = balanceSelectedMatch(players, [], recentPairs, [], new Set());
  const teamA = balanced.slice(0, 2);
  const teamB = balanced.slice(2, 4);
  expect(teamA.slice().sort()).not.toEqual(['P1', 'P2']);
  expect(teamB.slice().sort()).not.toEqual(['P1', 'P2']);

  // When P1+P2 is an explicit locked pair, they MUST stay together regardless of recentPairs
  const withLock = balanceSelectedMatch(players, [['P1', 'P2']], recentPairs, [], new Set());
  expect(withLock.slice(0, 2).sort()).toEqual(['P1', 'P2']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/doublesEngine.test.ts -t "balances 4 unlocked players" --run`
Expected: FAIL with "balanceSelectedMatch is not defined"

- [ ] **Step 3: Implement `balanceSelectedMatch` and wire into `rotateMultiCourtDoubles` & `multiCourtResult.ts`**

1. In `app/queue/lib/doublesEngine.ts`:
   - If `selectedPlayers.length === 4` and no locked pair is contained inside `selectedPlayers`: call `formTeams` with `recentPairs`, `recentMatches`, `lastMatchPlayers`, `skillMap`, returning `[...teamA, ...teamB]`.
   - If 1 or 2 locked pairs exist inside `selectedPlayers`: keep locked pair(s) intact as `[pair1A, pair1B, otherA, otherB]`.
2. In `app/queue/lib/multiCourtResult.ts`:
   - Derive `recentPairs` and `recentMatches` from `state.history` (last 6 doubles matches) when calling `rotateMultiCourtDoubles`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/doublesEngine.test.ts tests/multiCourtEngine.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/queue/lib/doublesEngine.ts app/queue/lib/multiCourtResult.ts tests/doublesEngine.test.ts
git commit -m "feat(doubles): add team anti-repeat and skill balance to multi-court rotation"
```

---

### Task 3: Multi-Court Singles 3-Win Streak Limit Parity

**Files:**
- Modify: `app/queue/lib/multiCourtResult.ts:56-112`
- Test: `tests/multiCourtResult.test.ts`

**Interfaces:**
- Consumes: `MultiCourtResultInput` in `app/queue/lib/multiCourtResult.ts`.
- Produces: `export const MULTI_COURT_SINGLES_MAX_STREAK = 3;` and automatic king rotation after 3 consecutive wins on a court.

- [ ] **Step 1: Write the failing test**

Create `tests/multiCourtResult.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { planMultiCourtResult } from '../app/queue/lib/multiCourtResult';

describe('multiCourtResult singles 3-win streak cap', () => {
  it('forces rotation when king reaches 3 consecutive wins on a court', () => {
    const state = {
      gameMode: 'singles' as const,
      courtSlots: [
        { id: 'c1', name: 'Court 1', onCourt: ['KingPlayer', 'Challenger3'] },
      ],
      queue: ['Challenger4', 'Challenger5'],
      history: [
        { id: 2, mode: 'Singles (Court 1)', players: 'KingPlayer vs Challenger2', winner: 'KingPlayer', timestamp: '10:05' },
        { id: 1, mode: 'Singles (Court 1)', players: 'KingPlayer vs Challenger1', winner: 'KingPlayer', timestamp: '10:00' },
      ],
    };

    const next = planMultiCourtResult(state as any, 'c1', 'A');
    expect(next.courtSlots[0].onCourt).toEqual(['Challenger4', 'Challenger5']);
    expect(next.queue).toEqual(['Challenger3', 'KingPlayer']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/multiCourtResult.test.ts --run`
Expected: FAIL because `KingPlayer` remains on court `[KingPlayer, Challenger4]`.

- [ ] **Step 3: Implement 3-win streak cap in `app/queue/lib/multiCourtResult.ts`**

In `app/queue/lib/multiCourtResult.ts`:
- Add optional `history?: Array<{ mode?: string; players: string; winner: string }>` to `MultiCourtResultInput`.
- Count consecutive prior wins by `winner` on `slot.name` in `state.history`.
- When `priorWins + 1 >= MULTI_COURT_SINGLES_MAX_STREAK` (3) and `orderedWaiting.length >= 2`:
  - Assign `[orderedWaiting[0], orderedWaiting[1]]` to `nextOnCourt`.
  - Append both `loser` and `winner` (in that order) to the back of the waiting queue.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/multiCourtResult.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/queue/lib/multiCourtResult.ts tests/multiCourtResult.test.ts
git commit -m "feat(singles): enforce 3-win streak cap in multi-court singles rotation"
```

---

### Task 4: Setup Partner Lock Seeding & Session Start Fix

**Files:**
- Modify: `app/queue/page.tsx:720-770`
- Test: `tests/partnerAwareMultiCourt.test.ts`

**Interfaces:**
- Consumes: `lockedPartners` state in `app/queue/page.tsx`.
- Produces: Active `LockedPartnerPair[]` passed to `seedMultiCourtDoubles` and persisted to `session.startSession`.

- [ ] **Step 1: Write the failing test**

Create `tests/partnerAwareMultiCourt.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { seedMultiCourtDoubles, type LockedPartnerPair } from '../app/queue/lib/doublesEngine';

describe('partnerAwareMultiCourt seeding', () => {
  it('places pre-locked partner pairs on the same court team during initial multi-court seed', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    const locked: LockedPartnerPair[] = [['P1', 'P6']];
    const seeded = seedMultiCourtDoubles(players, 2, locked);
    expect(seeded.courts[0].slice(0, 2)).toEqual(['P1', 'P6']);
    expect(seeded.courts[0]).toHaveLength(4);
    expect(seeded.courts[1]).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test and inspect `app/queue/page.tsx:723,764`**

Run: `npm.cmd test -- tests/partnerAwareMultiCourt.test.ts --run`
Update `app/queue/page.tsx`:
- Line 723: Filter `lockedPartners` to pairs where both players exist in `orderedPlayers`, pass `activeLockedPairs` into `seedMultiCourtDoubles(orderedPlayers, courtCount, activeLockedPairs)`.
- Line 764: Pass `lockedPartners: activeLockedPairs.map(([a, b]) => ({ a, b }))` instead of `[]`, and preserve `lockedPartners` state instead of clearing to `[]` on line 788.

- [ ] **Step 3: Run test to verify it passes**

Run: `npm.cmd test -- tests/partnerAwareMultiCourt.test.ts --run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/queue/page.tsx tests/partnerAwareMultiCourt.test.ts
git commit -m "fix(setup): preserve locked partner pairs during initial multi-court seeding"
```

---

### Task 5: Pre-Session Check-In Engine & Local Storage Draft (`app/queue/lib/checkInState.ts`)

**Files:**
- Create: `app/queue/lib/checkInState.ts`
- Test: `tests/checkInState.test.ts`

**Interfaces:**
- Consumes: `sanitizePlayerName` from `app/queue/lib/pasteParser.ts`.
- Produces:
  ```ts
  export interface PreSessionCheckInState {
    expected: string[];
    checkedIn: string[];
  }
  export function createInitialCheckInState(): PreSessionCheckInState;
  export function addPlayersToCheckIn(
    state: PreSessionCheckInState,
    names: string[],
    target: 'expected' | 'checkedIn',
    maxTotal?: number,
  ): PreSessionCheckInState;
  export function checkInPlayer(state: PreSessionCheckInState, name: string): PreSessionCheckInState;
  export function undoCheckInPlayer(state: PreSessionCheckInState, name: string): PreSessionCheckInState;
  export function checkInAllPlayers(state: PreSessionCheckInState, maxCheckedIn?: number): PreSessionCheckInState;
  export function removePlayerFromCheckIn(state: PreSessionCheckInState, name: string): PreSessionCheckInState;
  export function saveCheckInDraft(storageKey: string, state: PreSessionCheckInState): void;
  export function loadCheckInDraft(storageKey: string): PreSessionCheckInState | null;
  export function clearCheckInDraft(storageKey: string): void;
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/checkInState.test.ts` testing:
- Arrival order preservation (`checkedIn` is FIFO).
- Case-insensitive deduplication across both `expected` and `checkedIn`.
- Undo check-in moves player back to `expected`.
- `checkInAllPlayers` respects the 30-player cap (`maxCheckedIn = 30`).
- `saveCheckInDraft` / `loadCheckInDraft` / `clearCheckInDraft` round-trip.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/checkInState.test.ts --run`
Expected: FAIL with "Cannot find module '../app/queue/lib/checkInState'"

- [ ] **Step 3: Implement `app/queue/lib/checkInState.ts`**

Implement pure state transitions and `try/catch`-wrapped `localStorage` helpers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/checkInState.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/queue/lib/checkInState.ts tests/checkInState.test.ts
git commit -m "feat(setup): add pre-session check-in state engine and draft persistence"
```

---

### Task 6: SetupView UI: "Not Yet Here" Intake & Arrival-Order Check-In

**Files:**
- Modify: `app/queue/components/SetupView/SetupView.tsx`
- Modify: `app/queue/QueueSystem.css`
- Modify: `app/queue/page.tsx`
- Test: `tests/SetupView.test.tsx`

**Interfaces:**
- Consumes: `PreSessionCheckInState`, `parsePlayerListPaste`.
- Produces: Backward-compatible optional props on `SetupViewProps`:
  ```ts
  expectedPlayers?: string[];
  onCheckInPlayer?: (name: string) => void;
  onUndoCheckInPlayer?: (name: string) => void;
  onCheckInAll?: () => void;
  onRemoveExpectedPlayer?: (name: string) => void;
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/SetupView.test.tsx`:
- Renders **Checked In** list with arrival numbers (`#1`, `#2`) and **Expected (Not Yet Here)** list with 1-tap `Check in` buttons and `Check In All`.
- Keeps `Start Queue` button disabled until `tempPlayers.length >= minPlayers` (checked-in count), even if `expectedPlayers` has 10 names.
- Clicking `Check in` fires `onCheckInPlayer(name)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/SetupView.test.tsx --run`
Expected: FAIL (Expected Arrivals section not rendered yet).

- [ ] **Step 3: Implement two-tier Check-In UI in `SetupView.tsx`, `page.tsx`, and `QueueSystem.css`**

- In `SetupView.tsx`:
  - Render **Expected / Not Yet Here** panel when `expectedPlayers.length > 0` with `Check In All` button and per-player `+ Check In` chip.
  - Render **Checked In** list (`tempPlayers`) with `#1..#N` arrival order badges and optional `Undo` button to move back to Expected.
- In `page.tsx`:
  - Route paste/roster imports into `expectedPlayers` (or provide a quick `Check In All` 1-tap button), and when `handleStartQueue` succeeds, persist remaining `expectedPlayers` to `localStorage` under `padq_late_arrivals_${sessionId}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/SetupView.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/queue/components/SetupView/SetupView.tsx app/queue/page.tsx app/queue/QueueSystem.css tests/SetupView.test.tsx
git commit -m "feat(setup): render two-tier check-in UI with arrival order and expected roster"
```

---

### Task 7: Live Host Tools: Late-Arrival Check-In Tray

**Files:**
- Modify: `app/queue/components/LiveManagement/LiveManagement.tsx`
- Modify: `app/queue/page.tsx`
- Modify: `app/queue/QueueSystem.css`
- Test: `tests/lateArrivalTray.test.tsx`

**Interfaces:**
- Consumes: `padq_late_arrivals_${sessionId}` from `localStorage` and `handleAddPlayerLive`.
- Produces: Optional `lateArrivals?: string[]`, `onCheckInLateArrival?: (name: string) => void`, `onDismissLateArrival?: (name: string) => void` in `AddPlayerPanel` (`LiveManagement.tsx`).

- [ ] **Step 1: Write the failing test**

Create `tests/lateArrivalTray.test.tsx`:
- Renders `Late Arrivals` tray inside `AddPlayerPanel` when `lateArrivals` is non-empty.
- Clicking `+ Check In` next to an expected player invokes `onCheckInLateArrival(name)`.
- Clicking `×` dismisses the no-show from the tray.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/lateArrivalTray.test.tsx --run`
Expected: FAIL

- [ ] **Step 3: Implement Late Arrivals tray in `LiveManagement.tsx` and wire in `page.tsx`**

- In `LiveManagement.tsx` (`AddPlayerPanel`): Render the `Late Arrivals (Not Yet Checked In)` chip list above the manual input field.
- In `page.tsx`: When `handleCheckInLateArrival(name)` is triggered, call `handleAddPlayerLive(name)` and remove `name` from `lateArrivals` state + `localStorage`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/lateArrivalTray.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/queue/components/LiveManagement/LiveManagement.tsx app/queue/page.tsx app/queue/QueueSystem.css tests/lateArrivalTray.test.tsx
git commit -m "feat(host): add 1-tap late arrival check-in tray to live host tools"
```

---

## Phase 2: Spectator (`/watch`) Full Queue Visibility, ETA Badges & Turn Alerts

### Task 8: Full Waiting Queue & Deterministic ETA Badges on `/watch` (`LiveCourtStatus.tsx`)

**Files:**
- Modify: `app/watch/[sessionId]/LiveCourtStatus.tsx:166-210`
- Modify: `app/watch/[sessionId]/watch.css`
- Test: `tests/liveCourtStatus.test.tsx`

**Interfaces:**
- Consumes: `formatEtaLabel` from `app/queue/lib/etaEngine.ts`.
- Produces: Full numbered waiting list in `LiveCourtStatus` with `Up next` / `Wait: N matches` badges for every waiting player (replacing the hidden `+N waiting` truncation).

- [ ] **Step 1: Write the failing test**

Add test in `tests/liveCourtStatus.test.tsx`:
```ts
it('renders all waiting players with deterministic ETA badges instead of hiding players #5+', () => {
  const courtSlots = [
    { id: 'c1', name: 'Court 1', onCourt: ['P1', 'P2', 'P3', 'P4'] },
    { id: 'c2', name: 'Court 2', onCourt: ['P5', 'P6', 'P7', 'P8'] },
  ];
  const queue = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
  const { getByText } = render(
    <LiveCourtStatus
      courtSlots={courtSlots}
      gameMode="doubles"
      queue={queue}
      selectedCourtId="c1"
      onSelectCourt={() => {}}
    />
  );
  // W5 and W6 must be visible with their queue number and ETA label
  expect(getByText(/W5/)).toBeTruthy();
  expect(getByText(/W6/)).toBeTruthy();
  expect(getByText('Wait: 2 matches')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/liveCourtStatus.test.tsx --run`
Expected: FAIL because `W5` and `W6` are currently hidden behind `+2 waiting`.

- [ ] **Step 3: Update `LiveCourtStatus.tsx` to render full waiting queue with `formatEtaLabel`**

In `app/watch/[sessionId]/LiveCourtStatus.tsx`:
- Import `formatEtaLabel` from `@/app/queue/lib/etaEngine`.
- Render `waitingQueue.map((player, index) => ...)` with `#${index + 1}`, partner badge `🔗`, priority badge, and `formatEtaLabel(index + 1, playersNeeded, true)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/liveCourtStatus.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/watch/[sessionId]/LiveCourtStatus.tsx app/watch/[sessionId]/watch.css tests/liveCourtStatus.test.tsx
git commit -m "feat(watch): display full waiting queue with deterministic ETA badges"
```

---

### Task 9: "Tap Your Name" Spectator Turn Alert (`app/queue/lib/turnAlert.ts` & `/watch`)

**Files:**
- Create: `app/queue/lib/turnAlert.ts`
- Modify: `app/watch/[sessionId]/LiveCourtStatus.tsx`
- Modify: `app/watch/[sessionId]/page.tsx`
- Test: `tests/turnAlert.test.ts`

**Interfaces:**
- Consumes: Previous and current court/queue snapshots on `/watch`.
- Produces:
  ```ts
  export type PlayerTurnZone = 'on-court' | 'on-deck' | 'waiting' | 'absent';
  export function getPlayerTurnZone(
    playerName: string,
    courtSlots: Array<{ name: string; onCourt: string[] }>,
    waitingQueue: string[],
    playersPerMatch: number,
  ): { zone: PlayerTurnZone; courtName?: string };
  export function shouldTriggerTurnAlert(
    prevZone: PlayerTurnZone | null,
    nextZone: PlayerTurnZone,
  ): boolean;
  export function fireBrowserTurnAlert(message: string): void;
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/turnAlert.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getPlayerTurnZone, shouldTriggerTurnAlert } from '../app/queue/lib/turnAlert';

describe('turnAlert', () => {
  const courts = [{ name: 'Court 1', onCourt: ['A', 'B', 'C', 'D'] }];
  const queue = ['E', 'F', 'G', 'H', 'I', 'J'];

  it('classifies player into on-court, on-deck, or waiting', () => {
    expect(getPlayerTurnZone('B', courts, queue, 4)).toEqual({ zone: 'on-court', courtName: 'Court 1' });
    expect(getPlayerTurnZone('F', courts, queue, 4)).toEqual({ zone: 'on-deck' });
    expect(getPlayerTurnZone('I', courts, queue, 4)).toEqual({ zone: 'waiting' });
  });

  it('triggers alert only on upward transition into on-deck or on-court', () => {
    expect(shouldTriggerTurnAlert('waiting', 'on-deck')).toBe(true);
    expect(shouldTriggerTurnAlert('on-deck', 'on-court')).toBe(true);
    expect(shouldTriggerTurnAlert('waiting', 'on-court')).toBe(true);
    expect(shouldTriggerTurnAlert('on-court', 'on-court')).toBe(false);
    expect(shouldTriggerTurnAlert('on-court', 'waiting')).toBe(false);
    expect(shouldTriggerTurnAlert(null, 'on-deck')).toBe(false); // initial mount should not false-alarm
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/turnAlert.test.ts --run`
Expected: FAIL with "Cannot find module '../app/queue/lib/turnAlert'"

- [ ] **Step 3: Implement `app/queue/lib/turnAlert.ts` and wire tap-to-watch in `LiveCourtStatus.tsx` & `watch/[sessionId]/page.tsx`**

1. In `app/queue/lib/turnAlert.ts`:
   - Implement `getPlayerTurnZone`, `shouldTriggerTurnAlert`, and `fireBrowserTurnAlert` (triggers `navigator.vibrate?.([200, 100, 200])` and plays a gentle Web Audio API dual-tone chime wrapped in `try/catch`).
2. In `LiveCourtStatus.tsx` & `watch/[sessionId]/page.tsx`:
   - Allow spectators to tap any player chip in the queue to toggle `watchedPlayer` (saved in `sessionStorage` under `padq_watch_player_${sessionId}`), displaying a `🔔 Alert On` pill on their name and firing `fireBrowserTurnAlert` when `shouldTriggerTurnAlert` returns `true`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/turnAlert.test.ts tests/liveCourtStatus.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/queue/lib/turnAlert.ts app/watch/[sessionId]/LiveCourtStatus.tsx app/watch/[sessionId]/page.tsx tests/turnAlert.test.ts
git commit -m "feat(watch): add tap-your-name turn alerts with vibration and audio chime"
```

---

## Phase 3: Host Live Polish, History Correction & Personal Stat Cards

### Task 10: Live Elapsed Court Timer & Native TTS Callout (`CourtCard.tsx`)

**Files:**
- Create: `app/queue/lib/courtSpeechAndTimer.ts`
- Modify: `app/queue/components/CourtCard/CourtCard.tsx`
- Modify: `app/queue/components/CourtCard/CourtCard.module.css`
- Test: `tests/courtSpeechAndTimer.test.ts`

**Interfaces:**
- Consumes: `slot: CourtSlot` (`id`, `name`, `onCourt`) and `gameMode`.
- Produces:
  ```ts
  export function formatElapsedSeconds(seconds: number): string;
  export function buildCourtCalloutText(courtName: string, teamA: string[], teamB: string[], gameMode: 'singles' | 'doubles'): string;
  export function speakCourtCallout(text: string): boolean;
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/courtSpeechAndTimer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatElapsedSeconds, buildCourtCalloutText } from '../app/queue/lib/courtSpeechAndTimer';

describe('courtSpeechAndTimer', () => {
  it('formats elapsed seconds as mm:ss', () => {
    expect(formatElapsedSeconds(0)).toBe('00:00');
    expect(formatElapsedSeconds(65)).toBe('01:05');
    expect(formatElapsedSeconds(754)).toBe('12:34');
  });

  it('builds natural TTS callout phrasing for singles and doubles', () => {
    expect(
      buildCourtCalloutText('Court 1', ['Carlos', 'Jannik'], ['Rafael', 'Novak'], 'doubles'),
    ).toBe('Court 1: Carlos and Jannik, versus Rafael and Novak.');
    expect(
      buildCourtCalloutText('Court 2', ['Carlos'], ['Jannik'], 'singles'),
    ).toBe('Court 2: Carlos versus Jannik.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/courtSpeechAndTimer.test.ts --run`
Expected: FAIL with "Cannot find module '../app/queue/lib/courtSpeechAndTimer'"

- [ ] **Step 3: Implement `courtSpeechAndTimer.ts` and integrate into `CourtCard.tsx`**

1. In `app/queue/lib/courtSpeechAndTimer.ts`:
   - Implement `formatElapsedSeconds`, `buildCourtCalloutText`, and `speakCourtCallout` (using `window.speechSynthesis` safely).
   - Provide `getOrInitCourtStartTime(courtId: string, lineupKey: string): number` backed by `sessionStorage` so `CourtSlot` objects in Firestore never get extra keys (`firestore.rules` compliance).
2. In `app/queue/components/CourtCard/CourtCard.tsx`:
   - Display a subtle elapsed timer badge (`04:12`) in the header when `ready` is true.
   - Render a `Volume2` (`🔊`) callout button in the header for hosts to announce the court matchup on tap.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/courtSpeechAndTimer.test.ts tests/multiCourtScreen.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/queue/lib/courtSpeechAndTimer.ts app/queue/components/CourtCard/CourtCard.tsx app/queue/components/CourtCard/CourtCard.module.css tests/courtSpeechAndTimer.test.ts
git commit -m "feat(court): add client-side elapsed match timer and TTS voice callout to CourtCard"
```

---

### Task 11: Retroactive Match History Winner Flip & Score Correction (`AnalyticsDashboard.tsx`)

**Files:**
- Create: `app/queue/lib/historyCorrection.ts`
- Modify: `app/queue/components/AnalyticsDashboard/AnalyticsDashboard.tsx:348-378`
- Modify: `app/queue/page.tsx`
- Test: `tests/historyCorrection.test.ts`

**Interfaces:**
- Consumes: `MatchHistoryEntry` (`id`, `mode`, `players`, `winner`, `score`, `timestamp`).
- Produces:
  ```ts
  export function flipHistoryEntryWinner(entry: MatchHistoryEntry, newScore?: string): MatchHistoryEntry;
  ```
  And optional `onCorrectHistoryEntry?: (entryId: number, updated: MatchHistoryEntry) => void` on `AnalyticsDashboard`.

- [ ] **Step 1: Write the failing test**

Create `tests/historyCorrection.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { flipHistoryEntryWinner } from '../app/queue/lib/historyCorrection';
import { buildPlayerStats } from '../app/queue/lib/playerUtils';

describe('historyCorrection', () => {
  it('flips the winner between Team A and Team B and reverses score string if present', () => {
    const entry = {
      id: 101,
      mode: 'Doubles (Court 1)',
      players: 'Alice & Bob vs Charlie & Dana',
      winner: 'Alice & Bob',
      score: '11–9',
      timestamp: '19:30',
    };

    const flipped = flipHistoryEntryWinner(entry);
    expect(flipped.winner).toBe('Charlie & Dana');
    expect(flipped.score).toBe('9–11');

    const stats = buildPlayerStats(['Alice', 'Bob', 'Charlie', 'Dana'], [flipped]);
    const charlie = stats.find(s => s.name === 'Charlie')!;
    const alice = stats.find(s => s.name === 'Alice')!;
    expect(charlie.wins).toBe(1);
    expect(charlie.pointDiff).toBe(2);
    expect(alice.wins).toBe(0);
    expect(alice.pointDiff).toBe(-2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/historyCorrection.test.ts --run`
Expected: FAIL with "Cannot find module '../app/queue/lib/historyCorrection'"

- [ ] **Step 3: Implement `flipHistoryEntryWinner` and wire host action in `AnalyticsDashboard.tsx` & `page.tsx`**

1. In `app/queue/lib/historyCorrection.ts`:
   - Split `entry.players` on `' vs '` to get `[sideA, sideB]`.
   - Toggle `winner` to the opposite side.
   - If `newScore` is provided, set it; otherwise if `entry.score` matches `X–Y` or `X-Y`, swap the two numbers (`Y–X`).
2. In `AnalyticsDashboard.tsx`:
   - When `onCorrectHistoryEntry` is passed, render a compact `Flip Winner` button on each history row.
3. In `page.tsx`:
   - Update `localHistory` state immediately so `stats` and standings recalculate on the spot.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/historyCorrection.test.ts tests/analyticsDashboard.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/queue/lib/historyCorrection.ts app/queue/components/AnalyticsDashboard/AnalyticsDashboard.tsx app/queue/page.tsx tests/historyCorrection.test.ts
git commit -m "feat(history): allow host to retroactively flip match winner and recalculate standings"
```

---

### Task 12: Individual Player Spotlight Card in `RecapModal.tsx` & `RecapCard.tsx`

**Files:**
- Modify: `app/queue/components/RecapCard/RecapCard.tsx`
- Modify: `app/queue/components/RecapCard/RecapModal.tsx`
- Modify: `app/queue/components/RecapCard/RecapCard.css`
- Test: `tests/RecapModal.test.tsx`

**Interfaces:**
- Consumes: `stats: PlayerStat[]` sorted by `comparePlayerStats`.
- Produces: 3rd variant `'player'` in `RecapCardProps` & `RecapModalProps` with `selectedPlayerName?: string`:
  ```ts
  export interface RecapCardProps {
    stats: PlayerStat[];
    history: MatchHistoryEntry[];
    roomCode?: string | null;
    mode?: string;
    variant?: 'host' | 'viewer' | 'player';
    selectedPlayerName?: string;
  }
  ```

- [ ] **Step 1: Write the failing test**

Add test in `tests/RecapModal.test.tsx`:
```ts
it('allows switching to Player Card tab and selecting any player to render their personal spotlight card', () => {
  const { getByText, getByLabelText } = render(
    <RecapModal
      isOpen={true}
      onClose={() => {}}
      stats={mockStats}
      history={mockHistory}
      roomCode="PADQ01"
      mode="Doubles"
    />
  );

  fireEvent.click(getByText(/Player Card/i));
  const select = getByLabelText(/Select player/i) as HTMLSelectElement;
  fireEvent.change(select, { target: { value: mockStats[1].name } });
  expect(getByText(new RegExp(`#2 OF ${mockStats.length}`, 'i'))).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/RecapModal.test.tsx --run`
Expected: FAIL (no `Player Card` tab or selector yet).

- [ ] **Step 3: Add `'player'` variant to `RecapCard.tsx` and tab + dropdown to `RecapModal.tsx`**

1. In `RecapCard.tsx`:
   - When `variant === 'player'`, locate the selected player's rank (`#rank OF total`) and render a large spotlight card showing their Name, Rank Badge, `W - L`, `Win %`, `Point Diff`, `Matchup Strength`, and `Streak`.
2. In `RecapModal.tsx`:
   - Add a `Player Card` toggle button alongside `Podium` and `Standings`, plus a `<select aria-label="Select player">` dropdown populated with sorted player names.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/RecapModal.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/queue/components/RecapCard/RecapCard.tsx app/queue/components/RecapCard/RecapModal.tsx app/queue/components/RecapCard/RecapCard.css tests/RecapModal.test.tsx
git commit -m "feat(recap): add individual player spotlight stat card variant to RecapModal"
```

---

### Task 13: End-to-End Regression & Capacity Verification

**Files:**
- Create: `tests/fullSessionParity.test.ts`

**Interfaces:**
- Consumes: All modules created and modified in Tasks 1–12.
- Produces: Full end-to-end simulation and release verification.

- [ ] **Step 1: Write comprehensive end-to-end simulation test**

Create `tests/fullSessionParity.test.ts` covering:
1. Pasting 20 noisy WhatsApp/Reclub player lines via `parsePlayerListPaste`.
2. Loading into `checkInState`, checking in 12 arrived players, leaving 8 in `expected`.
3. Seeding 3 doubles courts with 1 pre-locked duo (`seedMultiCourtDoubles`).
4. Rotating courts with `balanceSelectedMatch` anti-repeat partner balancing.
5. Checking in 2 late arrivals mid-session.
6. Verifying `formatEtaLabel` and `shouldTriggerTurnAlert` for waiting spectators.
7. Flipping a misreported match winner via `flipHistoryEntryWinner` and verifying recalculated 4-tier standings.
8. Enforcing the 3-win streak cap in multi-court singles (`planMultiCourtResult`).

- [ ] **Step 2: Run full Vitest test suite**

Run: `npm.cmd test -- --run`
Expected: ALL test files pass (455+ existing tests + all new test suites).

- [ ] **Step 3: Run TypeScript compiler check**

Run: `npx.cmd tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Run ESLint**

Run: `npm.cmd run lint`
Expected: 0 errors.

- [ ] **Step 5: Final commit**

```bash
git add tests/fullSessionParity.test.ts
git commit -m "test: add comprehensive end-to-end parity and UX verification suite"
```
