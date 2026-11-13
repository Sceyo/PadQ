# Fix Six Live Wiring Bugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Connect all six isolated parity features (smart paste parsing, multi-court anti-repeat/streak history & skill balancing, pre-session check-in & late-arrival handoff, mobile `HostToolsSheet` late-arrival tray, spectator turn alerts across multi/single-court `/watch`, and Firestore-persisted retroactive winner flips) into the live `V1_RELEASE.mobileFirstShell = true` production UI and Firestore transaction layer.

**Architecture:** Wire existing unit-tested domain modules (`pasteParser.ts`, `multiCourtResult.ts`, `checkInState.ts`, `turnAlert.ts`, `historyCorrection.ts`) into `app/queue/page.tsx`, `AppShell`/`HostToolsSheet`, `lib/sessionService.ts`, and `app/watch/[sessionId]/page.tsx` without altering the closed `firestore.rules` schema. Multi-court match commits forward bounded match history and numeric skill maps into `commitMultiCourtResult`, while retroactive history corrections execute an atomic Firestore `delete + parent revision+1 + create` transaction that satisfies immutable history rules and syncs live to `/watch` spectators.

**Tech Stack:** Next.js 16 (App Router, React 19), TypeScript, Firebase Auth + Cloud Firestore (`runTransaction`), Vitest (`@firebase/rules-unit-testing`), Playwright (`390×844` mobile viewport).

**Spec:** `docs/superpowers/plans/2026-11-01-pre-session-checkin-and-engine-parity.md` and `firestore.rules`

## Global Constraints

- **Closed Firestore Security Schema:** Do **not** modify `firestore.rules`. Session documents are capped at `5..30` players (`V1_RELEASE.maxPlayers = 30`), `1..3` courts (`V1_RELEASE.maxCourts = 3`), and `sessions/{sessionId}/history/{commandId}` enforces `allow update: if false`, `allow delete: if parentOwned()`, and `allow create` tied to `parent.revision == entry.revision`.
- **Active Shell Target:** `V1_RELEASE.mobileFirstShell` is `true` (`app/queue/lib/releaseConfig.ts:18`); every host feature must work inside `SetupView`, `AppShell`, `HostToolsSheet`, and `AnalyticsDashboard`.
- **Mobile Ergonomics:** Every newly wired interactive button/chip must render at `>= 44px` height on `390×844` viewports (`var(--tap-min, 44px)`) and form controls (`input`, `textarea`, `select`) must keep `font-size >= 16px` to prevent iOS Safari auto-zoom.
- **Selector Compatibility:** Preserve existing Playwright locators across all 12 `.pw.ts` suites — specifically `getByPlaceholder(/Paste names separated by commas/)`, `getByTitle('Add all')`, `getByRole('button', { name: 'Host Tools' })`, and viewer assertion `getByRole('button', { name: /wins?$/i })` having count `0` on `/watch`.
- **Branch Discipline:** Commit cleanly on `UI-Overhaul`; do **not** push or open a PR unless explicitly instructed.

## Review Focus

1. **Rapid consecutive multi-court wins before React re-render:** Recording 3 wins in quick succession on the same singles court must read from a synchronously updated `activeHistoryRef` (not stale render state) so the 3rd win rotates the King off court immediately (`Task 2`).
2. **Multi-line paste with `Waitlist:` cutoff and cross-list duplicates:** Pasting a numbered WhatsApp/Reclub list where one player is already in `expectedPlayers` must promote or skip cleanly without exceeding `30` total players or stripping `\n` in the paste field (`Task 1`, `Task 3`).
3. **Late-arrival check-in at the 30-player ceiling:** Tapping `Check In` inside `HostToolsSheet` when `players.length === 30` (`onAddPlayer` returns `false`) must keep the player in `lateArrivals` and surface an inline error rather than silently deleting them (`Task 4`).
4. **Single-court `/watch` turn-zone off-by-one:** When `session.courtSlots` is empty (`[]`), `session.queue.slice(0, playersPerMatch)` are **already on court**; `resolveWatchTurnContext` must synthesize the active court slot before calling `getPlayerTurnZone` so on-court players are `'on-court'` and `queue.slice(playersPerMatch, 2 * playersPerMatch)` are `'on-deck'` (`Task 5`).
5. **Double-flipping the same match winner (`A → B → A`):** After the first atomic `delete + create` rotates the history document's `commandId`, flipping that same match a second time must locate the replacement document (via updated `commandId` or `where('id', '==', entryId)` fallback) and obey `firestore.rules` (`Task 6`).

---

## File Structure

- **Create:** `app/queue/lib/watchTurnContext.ts` — Pure helper normalizing single-court and multi-court `SessionDoc` snapshots into `{ effectiveCourts, waitingQueue, playersPerMatch }` for `/watch` turn alerts and waiting chips.
- **Create:** `tests/setupCheckInWiring.test.ts` — Unit tests for smart paste + check-in state transitions (`addToCheckedIn`, `addToExpected`, `uncheckAll`, cross-list deduplication, and `startResult.sessionId` late-arrival storage keying).
- **Create:** `tests/hostToolsLateArrivals.test.ts` — Render/markup and callback tests for `HostToolsSheet` late-arrival check-in, capacity rejection retention, and dismiss actions.
- **Create:** `tests/watchTurnContext.test.ts` — Unit tests for single-court vs. multi-court `/watch` turn-zone resolution and keyboard/ARIA chip behavior.
- **Create:** `tests/e2e/live-wiring-regressions.pw.ts` — Full-stack mobile (`390×844`) Playwright E2E suite exercising all 6 wired flows against Firebase Auth + Firestore emulators.
- **Modify:** `app/queue/components/SetupView/SetupView.tsx` — Upgrade paste input to newline-preserving `<textarea>` (`16px` font), add `"Add as Expected"` action for paste/roster, add `"Uncheck All"` action on Checked-In list, and raise `.checkin-btn` / `.remove-expected-btn` touch targets to `44px`.
- **Modify:** `app/queue/QueueSystem.css` — Style `.paste-textarea` (`font-size: 16px`), `.add-expected-btn`, `.checkin-btn`, `.remove-expected-btn`, and `.history-flip-btn` with `min-height: var(--tap-min, 44px)`.
- **Modify:** `app/queue/lib/multiCourtResult.ts` — Export `buildNumericSkillMap` mapping session `PlayerStats` + `SkillBracket` tags onto `0..100` skill scores for `planMultiCourtResult`.
- **Modify:** `lib/sessionService.ts` — Extend `CourtResultCommand` with optional `history` and `skillMap` forwarded into `planMultiCourtResult`; add `replaceHistoryEntry` atomic `runTransaction` (`delete` old history doc + increment parent `revision` + `set` new history doc).
- **Modify:** `hooks/useSession.ts` — Expose `correctHistoryEntry(entryId, updated)` chained onto `revisionWriteChainRef`.
- **Modify:** `app/queue/components/HostToolsSheet/HostToolsSheet.tsx` & `app/queue/components/AppShell/AppShell.tsx` — Thread `lateArrivals`, `onCheckInLateArrival`, and `onDismissLateArrival` into `HostToolsSheet` with `>= 44px` buttons; also raise legacy `LiveManagement.tsx` late-arrival button heights to `44px`.
- **Modify:** `app/queue/page.tsx` — Wire `parsePlayerListPaste`, `checkInState.ts` helpers + draft persistence + `startResult.sessionId` handoff, `activeHistoryRef` + `numericSkillMap` into multi-court handlers and `commitCourtResult`, `lateArrivals` props into `AppShell`, and `onCorrectHistoryEntry` + `session.correctHistoryEntry` into all three `<AnalyticsDashboard />` renders.
- **Modify:** `app/watch/[sessionId]/LiveCourtStatus.tsx`, `app/watch/[sessionId]/page.tsx`, & `app/watch/[sessionId]/watch.css` — Export reusable `<WaitingQueueChips />` with `<button type="button">` (`44px` touch target, safe `aria-label`), pass `watchedPlayer` + `onToggleWatchPlayer` in both multi-court and single-court `/watch`, and use `resolveWatchTurnContext` in the turn-alert `useEffect`.
- **Modify:** `tests/multiCourtResult.test.ts` & `tests/firestore.rules.test.ts` — Add tests for `buildNumericSkillMap` + history-backed `commitMultiCourtResult` parity and Firestore security rules verification of `replaceHistoryEntry`.

---

### Task 1: Wire Smart Paste Parser & Multi-Line Paste Field in Setup (Bug #1)

**Files:**
- Modify: `app/queue/lib/checkInState.ts:28-73`
- Modify: `app/queue/components/SetupView/SetupView.tsx:307-328`
- Modify: `app/queue/QueueSystem.css:4720-4795`
- Modify: `app/queue/page.tsx:748-774`
- Create: `tests/setupCheckInWiring.test.ts`

**Interfaces:**
- Consumes: `parsePlayerListPaste(raw: string): string[]` from `app/queue/lib/pasteParser.ts`
- Produces: `resolvePastedPlayers(rawInput: string, state: PreSessionCheckInState, target: 'checkedIn' | 'expected', maxTotal?: number): { nextState: PreSessionCheckInState; addedCount: number; duplicateCount: number }` in `app/queue/lib/checkInState.ts`

- [x] **Step 1: Write the failing unit tests for smart paste resolution & cross-list deduplication**

In `tests/setupCheckInWiring.test.ts`, write tests asserting:
```ts
import { describe, expect, it } from 'vitest';
import { resolvePastedPlayers } from '../app/queue/lib/checkInState';

describe('resolvePastedPlayers (Bug #1)', () => {
  it('sanitizes numbered Reclub/WhatsApp lists and stops at Waitlist header', () => {
    const raw = 'Confirmed:\n1. Juan (PAID)\n2. Maria ✅ - Guest\nWaitlist:\n3. Sub Player';
    const res = resolvePastedPlayers(raw, { expected: [], checkedIn: [] }, 'checkedIn', 30);
    expect(res.nextState.checkedIn).toEqual(['Juan', 'Maria']);
    expect(res.addedCount).toBe(2);
    expect(res.duplicateCount).toBe(0);
  });

  it('promotes an expected player to checkedIn on paste and counts already-checked-in names as duplicates', () => {
    const raw = '1. Ana (PAID)\n2. Ben\n3. Ana\n4. Cara';
    const initial = { expected: ['Ben'], checkedIn: ['Ana'] };
    const res = resolvePastedPlayers(raw, initial, 'checkedIn', 30);
    expect(res.nextState.checkedIn).toEqual(['Ana', 'Ben', 'Cara']);
    expect(res.nextState.expected).toEqual([]);
    expect(res.addedCount).toBe(2); // Ben promoted + Cara added
    expect(res.duplicateCount).toBe(2); // Ana appeared twice while already checked in
  });

  it('enforces the 30-player total cap across expected + checkedIn', () => {
    const existing = Array.from({ length: 29 }, (_, i) => `P${i + 1}`);
    const res = resolvePastedPlayers('1. NewOne\n2. NewTwo', { expected: [], checkedIn: existing }, 'checkedIn', 30);
    expect(res.nextState.checkedIn).toHaveLength(30);
    expect(res.nextState.checkedIn[29]).toBe('NewOne');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/setupCheckInWiring.test.ts`
Expected: FAIL with `resolvePastedPlayers is not a function` (or missing export).

- [x] **Step 3: Implement `resolvePastedPlayers` and wire it into `SetupView` & `app/queue/page.tsx`**

1. In `app/queue/lib/checkInState.ts`, import `parsePlayerListPaste` from `./pasteParser` and implement `resolvePastedPlayers(rawInput, state, target, maxTotal = 30)` so it parses `rawInput` via `parsePlayerListPaste(rawInput).filter(n => n.length <= 60)`, counts duplicates (names already in `checkedIn` when `target === 'checkedIn'`, or already in either list when `target === 'expected'`, plus intra-paste repeats), delegates list updates to `addPlayersToCheckIn`, and returns `{ nextState, addedCount, duplicateCount }`.
2. In `app/queue/components/SetupView/SetupView.tsx:307-328`, replace `<input type="text" value={pasteInput} ... />` with `<textarea rows={2} className="paste-textarea" value={pasteInput} placeholder="Paste names separated by commas or numbered list…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddFromPaste(); } }} ... />` while keeping the submit button's `title="Add all"` and `className="add-btn add-btn--paste"`.
3. In `app/queue/QueueSystem.css`, style `.paste-textarea` with `font-size: 16px`, `min-height: 44px`, `resize: vertical`, matching `.input-group input` borders/colors so iOS Safari never auto-zooms.
4. In `app/queue/page.tsx:748-774`, update `addFromPaste(target: 'checkedIn' | 'expected' = 'checkedIn')` to call `resolvePastedPlayers(pasteInput, { expected: expectedPlayers, checkedIn: tempPlayers }, target, V1_RELEASE.maxPlayers)`, update both `setTempPlayers(nextState.checkedIn)` and `setExpectedPlayers(nextState.expected)`, keep the duplicate toast message, and clear `pasteInput`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- tests/setupCheckInWiring.test.ts tests/pasteParser.test.ts tests/responsiveGuards.test.ts`
Expected: PASS on all suites (with no new `input`/`textarea` < 16px regressions).

- [x] **Step 5: Commit**

```bash
git add app/queue/lib/checkInState.ts app/queue/components/SetupView/SetupView.tsx app/queue/QueueSystem.css app/queue/page.tsx tests/setupCheckInWiring.test.ts
git commit -m "feat(setup): wire smart paste parser and multiline textarea in SetupView"
```

---

### Task 2: Wire `history` & `skillMap` into Multi-Court Live Handlers & Firestore Transaction (Bug #2)

**Files:**
- Modify: `app/queue/lib/multiCourtResult.ts:18-60`
- Modify: `lib/sessionService.ts:327-336,418-431`
- Modify: `app/queue/page.tsx:645-692,1158-1215,1497-1565`
- Modify: `tests/multiCourtResult.test.ts`

**Interfaces:**
- Produces in `app/queue/lib/multiCourtResult.ts`:
  ```ts
  export function buildNumericSkillMap(
    statsList: Array<{ name: string; played: number; winRate: number }>,
    rosterSkillMap?: Record<string, 'beginner' | 'intermediate' | 'advanced' | undefined>,
  ): Record<string, number>;
  ```
- Extends `CourtResultCommand` in `lib/sessionService.ts`:
  ```ts
  export interface CourtResultCommand {
    courtId: string;
    expectedPlayers: string[];
    winningSide: 'A' | 'B';
    gameMode: 'singles' | 'doubles';
    id: number;
    timestamp: string;
    score?: string;
    history?: Array<{ id?: number; mode?: string; players: string; winner: string; timestamp?: string; score?: string }>;
    skillMap?: Record<string, number>;
  }
  ```

- [x] **Step 1: Write the failing unit tests for `buildNumericSkillMap` and rapid 3-streak / anti-repeat command planning**

In `tests/multiCourtResult.test.ts`, add tests asserting:
1. `buildNumericSkillMap` maps unplayed bracket-tagged players to `{ beginner: 25, intermediate: 50, advanced: 75 }`, uses actual `winRate` (`0..100`) once `played >= 1`, and omits untagged/unplayed players (defaulting to `50` inside `doublesEngine`).
2. Sequential multi-court singles results feeding each returned `{ mode: \`Singles (\${planned.courtName})\`, players: planned.players, winner: planned.winner }` into the next `planMultiCourtResult` call keep the winner on Court 1 for wins 1 and 2, and rotate the winner off Court 1 to the end of `queue` on win 3 (`MULTI_COURT_SINGLES_MAX_STREAK = 3`).
3. Sequential multi-court doubles results passing `history` and `skillMap` avoid repeating the exact partnership from the immediately preceding match when waiting challengers allow an alternative pairing, and split two `100` win-rate players across opposing teams rather than stacking `100 + 100` vs `0 + 0`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/multiCourtResult.test.ts`
Expected: FAIL with `buildNumericSkillMap is not exported`.

- [x] **Step 3: Implement `buildNumericSkillMap` and forward `history` + `skillMap` through `page.tsx` and `commitMultiCourtResult`**

1. Implement `buildNumericSkillMap` in `app/queue/lib/multiCourtResult.ts`.
2. In `lib/sessionService.ts`:
   - Add optional `history` and `skillMap` fields to `CourtResultCommand`.
   - Pass `history: command.history` and `skillMap: command.skillMap` into `planMultiCourtResult(...)` inside `commitMultiCourtResult` (`lib/sessionService.ts:418-430`). Do **not** write `history` or `skillMap` onto `SessionDoc` (preserving `firestore.rules`).
3. In `app/queue/page.tsx`:
   - Maintain `activeHistoryRef = useRef<MatchHistoryEntry[]>([])` kept in sync with `activeHistory`, and compute `numericSkillMap = useMemo(() => buildNumericSkillMap(statsList, rosterSkillMap), [statsList, rosterSkillMap])`.
   - In `handleSinglesMatch` multi-court branch (`page.tsx:1168-1200`), read `const currentHistory = activeHistoryRef.current;`, pass `history: currentHistory.slice(0, 25)` to both `planMultiCourtResult` and `session.commitCourtResult`, update `activeHistoryRef.current = [entry, ...currentHistory]` synchronously alongside `setLocalHistory`, and restore `activeHistoryRef.current` on rollback.
   - In `handleCourtMatch` multi-court doubles branch (`page.tsx:1497-1555`), read `const currentHistory = activeHistoryRef.current;`, pass `history: currentHistory.slice(0, 25)` and `skillMap: numericSkillMap` to both `planMultiCourtResult` and `session.commitCourtResult`, update `activeHistoryRef.current = [entry, ...currentHistory]` synchronously alongside `setLocalHistory`, and restore on rollback/stale status.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- tests/multiCourtResult.test.ts tests/firestore.rules.test.ts`
Expected: PASS on all tests.

- [x] **Step 5: Commit**

```bash
git add app/queue/lib/multiCourtResult.ts lib/sessionService.ts app/queue/page.tsx tests/multiCourtResult.test.ts
git commit -m "fix(engine): forward match history and skillMap through live multi-court commits"
```

---

### Task 3: Complete Pre-Session Check-In Actions & Fix `startResult.sessionId` Handoff (Bug #3)

**Files:**
- Modify: `app/queue/lib/checkInState.ts:115-200`
- Modify: `app/queue/components/SetupView/SetupView.tsx:46-52,269-288,307-413`
- Modify: `app/queue/QueueSystem.css:4720-4795`
- Modify: `app/queue/page.tsx:220-276,734-775,849-866,1881-1937,2115-2140`
- Modify: `tests/setupCheckInWiring.test.ts`

**Interfaces:**
- Produces in `app/queue/lib/checkInState.ts`:
  ```ts
  export const CHECKIN_DRAFT_KEY = 'padq_checkin_draft';
  export const lateArrivalsStorageKey = (sessionId: string) => `padq_late_arrivals_${sessionId}`;
  export function uncheckAllPlayers(state: PreSessionCheckInState): PreSessionCheckInState;
  export function persistSessionLateArrivals(sessionId: string, expected: string[]): string[];
  export function loadSessionLateArrivals(sessionId: string): string[];
  export function saveSessionLateArrivals(sessionId: string, lateArrivals: string[]): void;
  ```
- Extends `SetupViewProps` in `app/queue/components/SetupView/SetupView.tsx`:
  ```ts
  onAddExpectedFromPaste?: () => void;
  onAddExpectedFromRoster?: () => void;
  onUncheckAll?: () => void;
  ```

- [x] **Step 1: Write the failing unit tests for `uncheckAllPlayers` and `persistSessionLateArrivals` keying**

Append to `tests/setupCheckInWiring.test.ts`:
```ts
import {
  uncheckAllPlayers,
  persistSessionLateArrivals,
  loadSessionLateArrivals,
  CHECKIN_DRAFT_KEY,
  saveCheckInDraft,
  loadCheckInDraft,
} from '../app/queue/lib/checkInState';

describe('Pre-Session Check-In handoff & batch uncheck (Bug #3)', () => {
  it('moves all checked-in players into expected without duplicates on uncheckAllPlayers', () => {
    const next = uncheckAllPlayers({ expected: ['Zed'], checkedIn: ['Ana', 'Ben'] });
    expect(next).toEqual({ expected: ['Zed', 'Ana', 'Ben'], checkedIn: [] });
  });

  it('persists remaining expected players under padq_late_arrivals_<startResult.sessionId> and clears draft', () => {
    saveCheckInDraft(CHECKIN_DRAFT_KEY, { expected: ['Late1', 'Late2'], checkedIn: ['P1', 'P2', 'P3', 'P4', 'P5'] });
    const handedOff = persistSessionLateArrivals('ABC234', ['Late1', 'Late2']);
    expect(handedOff).toEqual(['Late1', 'Late2']);
    expect(loadSessionLateArrivals('ABC234')).toEqual(['Late1', 'Late2']);
    expect(loadCheckInDraft(CHECKIN_DRAFT_KEY)).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/setupCheckInWiring.test.ts`
Expected: FAIL with missing exports `uncheckAllPlayers` / `persistSessionLateArrivals`.

- [x] **Step 3: Implement check-in helpers, `SetupView` Expected/Uncheck controls, `44px` CSS hit areas, and `startResult.sessionId` handoff**

1. In `app/queue/lib/checkInState.ts`, implement `CHECKIN_DRAFT_KEY`, `lateArrivalsStorageKey`, `uncheckAllPlayers`, `persistSessionLateArrivals` (writes `lateArrivalsStorageKey(sessionId)` when `expected.length > 0`, removes it when empty, clears `CHECKIN_DRAFT_KEY`, and returns `[...expected]`), `loadSessionLateArrivals`, and `saveSessionLateArrivals`.
2. In `app/queue/components/SetupView/SetupView.tsx`:
   - Add `"Add as Expected"` button (`className="add-expected-btn"`, `onClick={onAddExpectedFromPaste}`, disabled when `!pasteInput.trim()`) next to the paste row when `onAddExpectedFromPaste` is provided.
   - Add `"Add as Expected"` button in `.roster-actions` (`onClick={onAddExpectedFromRoster}`, disabled when `rosterSelected.size === 0`) alongside `"Add Selected"`.
   - Add `"Uncheck All"` button (`className="uncheck-all-btn"`, `onClick={onUncheckAll}`) in `.setup-players-header` next to `.setup-checked-in-pill` when `tempPlayers.length > 0 && onUncheckAll`.
   - Mark roster items as already added when present in either `tempPlayers` or `expectedPlayers`.
3. In `app/queue/QueueSystem.css`, raise `.checkin-btn`, `.checkin-all-btn`, `.uncheck-all-btn`, `.add-expected-btn`, and `.remove-expected-btn` to `min-height: var(--tap-min, 44px)` (and `min-width: 44px` on `.remove-expected-btn`) so every Setup check-in button meets mobile touch-target standards.
4. In `app/queue/page.tsx`:
   - Import and use `checkInPlayer`, `undoCheckInPlayer`, `checkInAllPlayers`, `uncheckAllPlayers`, `removePlayerFromCheckIn`, `addPlayersToCheckIn`, `saveCheckInDraft`, `loadCheckInDraft`, `clearCheckInDraft`, `CHECKIN_DRAFT_KEY`, `persistSessionLateArrivals`, `loadSessionLateArrivals`, and `saveSessionLateArrivals` from `./lib/checkInState`.
   - Hydrate `{ expectedPlayers, tempPlayers }` from `loadCheckInDraft(CHECKIN_DRAFT_KEY)` on mount ONLY when `!localStorage.getItem('padq_host_session_id')` and `players.length === 0`, and persist changes to `CHECKIN_DRAFT_KEY` while in Setup.
   - Deduplicate `addTempPlayer` and `handleAddFromRoster` across both `tempPlayers` and `expectedPlayers` via `addPlayersToCheckIn`, and wire `onAddExpectedFromPaste={() => addFromPaste('expected')}`, `onAddExpectedFromRoster`, and `onUncheckAll` into `<SetupView />`.
   - Replace the broken duplicated `localStorage.setItem('padq_late_arrivals_' + (session.sessionId ?? 'draft'), ...)` block in `handleStartQueue` (`page.tsx:854-863`) with:
     ```ts
     const handedOffLate = persistSessionLateArrivals(startResult.sessionId, expectedPlayers);
     setLateArrivals(handedOffLate);
     setExpectedPlayers([]);
     ```
   - On `hard-reset` (`doConfirmedAction`), clear `CHECKIN_DRAFT_KEY`, clear `saveSessionLateArrivals(session.sessionId, [])`, and call `setLateArrivals([])`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- tests/setupCheckInWiring.test.ts tests/checkInState.test.ts`
Expected: PASS on all tests.

- [x] **Step 5: Commit**

```bash
git add app/queue/lib/checkInState.ts app/queue/components/SetupView/SetupView.tsx app/queue/QueueSystem.css app/queue/page.tsx tests/setupCheckInWiring.test.ts
git commit -m "fix(checkin): wire Expected/Uncheck actions in SetupView and persist late arrivals under startResult.sessionId"
```

---

### Task 4: Wire 1-Tap Late Arrivals Tray into `AppShell` & `HostToolsSheet` (Bug #4)

**Files:**
- Modify: `app/queue/components/HostToolsSheet/HostToolsSheet.tsx:16-150`
- Modify: `app/queue/components/AppShell/AppShell.tsx:19-66,105-145,190-214`
- Modify: `app/queue/components/LiveManagement/LiveManagement.tsx:40-75`
- Modify: `app/queue/page.tsx:231-251,1737-1771,2501-2581`
- Create: `tests/hostToolsLateArrivals.test.ts`

**Interfaces:**
- Extends `HostToolsSheet` `Props` & `AppShell` `Props`:
  ```ts
  lateArrivals?: string[];
  onCheckInLateArrival?: (name: string) => boolean | Promise<boolean>;
  onDismissLateArrival?: (name: string) => void;
  ```

- [x] **Step 1: Write the failing unit tests for `HostToolsSheet` late-arrival rendering and capacity guard**

In `tests/hostToolsLateArrivals.test.ts`, use `react-dom/server` (`renderToStaticMarkup`) plus state transition assertions to verify:
1. When `lateArrivals={['Carlos', 'Diana']}` is passed to `HostToolsSheet`, the rendered dialog contains `"Expected Late Arrivals (2)"`, accessible buttons `"Check in Carlos"`, `"Dismiss Carlos"`, `"Check in Diana"`, and `"Dismiss Diana"`, each styled with `min-height:44px` (or `var(--tap-min, 44px)`).
2. `applyLateArrivalCheckIn(lateArrivals, 'Carlos', addPlayerFn)` removes `'Carlos'` when `addPlayerFn('Carlos')` returns `true`, **but preserves `'Carlos'` in `lateArrivals`** when `addPlayerFn('Carlos')` returns `false` (e.g., 30-player capacity reached).
3. Manually adding `'carlos'` via `handleAddPlayerLive` removes `'Carlos'` case-insensitively from `lateArrivals`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/hostToolsLateArrivals.test.ts`
Expected: FAIL because `HostToolsSheet` ignores `lateArrivals` and `applyLateArrivalCheckIn` is missing.

- [x] **Step 3: Implement the `HostToolsSheet` Expected Late Arrivals tray, `AppShell` prop pass-through, and capacity-safe check-in**

1. Export pure helper `applyLateArrivalCheckIn(lateArrivals: string[], name: string, didAdd: boolean): string[]` from `app/queue/lib/checkInState.ts` (returns filtered list case-insensitively only when `didAdd === true`).
2. In `app/queue/components/HostToolsSheet/HostToolsSheet.tsx`:
   - Accept `lateArrivals = []`, `onCheckInLateArrival`, and `onDismissLateArrival`.
   - Above/inside the `"Add Late Player"` section, when `lateArrivals.length > 0`, render `"Expected Late Arrivals (${lateArrivals.length})"` with one row per player containing:
     - `<button type="button" aria-label={`Check in ${name}`} ...>` (`minHeight: 'var(--tap-min, 44px)'`, `padding: '0 14px'`) that calls `const ok = await onCheckInLateArrival?.(name); if (ok === false) setErrorMsg(\`"${name}" could not be checked in (session full or duplicate)\`);`.
     - `<button type="button" aria-label={`Dismiss ${name}`} ...>` (`minWidth: 'var(--tap-min, 44px)'`, `minHeight: 'var(--tap-min, 44px)'`) that calls `onDismissLateArrival?.(name)`.
3. In `app/queue/components/AppShell/AppShell.tsx`, accept `lateArrivals`, `onCheckInLateArrival`, `onDismissLateArrival` and forward them to `<HostToolsSheet />` (`AppShell.tsx:193`).
4. In `app/queue/components/LiveManagement/LiveManagement.tsx:45-68`, update the legacy `AddPlayerPanel` late-arrival `Check In` and `×` buttons to `minHeight: '44px'` (`minWidth: '44px'` on `×`) so legacy mode also satisfies mobile touch floors.
5. In `app/queue/page.tsx`:
   - Update `handleCheckInLateArrival(name: string): boolean` (`page.tsx:231`) to check `const ok = handleAddPlayerLive(name); if (!ok) return false;` before removing `name` via `applyLateArrivalCheckIn` and saving with `saveSessionLateArrivals`.
   - Inside `handleAddPlayerLive(name)` (`page.tsx:1737`), if `trimmedName` succeeds, also strip any case-insensitive match from `lateArrivals` and persist via `saveSessionLateArrivals` so manual additions auto-clear expected chips.
   - Pass `lateArrivals={lateArrivals}`, `onCheckInLateArrival={handleCheckInLateArrival}`, and `onDismissLateArrival={handleDismissLateArrival}` to `<AppShell>` at `page.tsx:2501`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- tests/hostToolsLateArrivals.test.ts`
Expected: PASS on all tests.

- [x] **Step 5: Commit**

```bash
git add app/queue/lib/checkInState.ts app/queue/components/HostToolsSheet/HostToolsSheet.tsx app/queue/components/AppShell/AppShell.tsx app/queue/components/LiveManagement/LiveManagement.tsx app/queue/page.tsx tests/hostToolsLateArrivals.test.ts
git commit -m "feat(host-tools): surface 44px 1-tap Expected Late Arrivals tray in HostToolsSheet"
```

---

### Task 5: Wire Spectator Turn Alerts & Waiting Queue Chips in Multi-Court & Single-Court `/watch` (Bug #5)

**Files:**
- Create: `app/queue/lib/watchTurnContext.ts`
- Modify: `app/watch/[sessionId]/LiveCourtStatus.tsx:14-42,165-225`
- Modify: `app/watch/[sessionId]/page.tsx:194-225,764-780,860-905`
- Modify: `app/watch/[sessionId]/watch.css:39-53,188-197,1029-1085`
- Create: `tests/watchTurnContext.test.ts`

**Interfaces:**
- Produces in `app/queue/lib/watchTurnContext.ts`:
  ```ts
  export interface WatchTurnContextInput {
    gameMode: 'singles' | 'doubles';
    courtName?: string;
    courtSlots?: Array<{ id: string; name: string; onCourt: string[] }>;
    queue?: string[];
    sittingOut?: string[];
    priorityPlayers?: string[];
  }
  export interface WatchTurnContext {
    playersPerMatch: 2 | 4;
    effectiveCourts: Array<{ id: string; name: string; onCourt: string[] }>;
    waitingQueue: string[];
    activeCourtCount: number;
  }
  export function resolveWatchTurnContext(input: WatchTurnContextInput): WatchTurnContext;
  ```
- Exports `<WaitingQueueChips />` from `app/watch/[sessionId]/LiveCourtStatus.tsx`:
  ```ts
  export interface WaitingQueueChipsProps {
    waitingQueue: string[];
    playersPerMatch: number;
    activeCourtCount: number;
    prioritySet: Set<string>;
    partnerMap: Map<string, string>;
    watchedPlayer?: string | null;
    onToggleWatchPlayer?: (playerName: string) => void;
  }
  ```

- [x] **Step 1: Write the failing unit tests for `resolveWatchTurnContext` and `<WaitingQueueChips />` accessibility**

In `tests/watchTurnContext.test.ts`, assert:
1. **Single-court doubles (`courtSlots: []`, `queue: ['P1','P2','P3','P4','P5','P6','P7','P8','P9']`):**
   - `effectiveCourts` is `[{ id: 'court-0', name: 'Court 1', onCourt: ['P1','P2','P3','P4'] }]`.
   - `waitingQueue` is `['P5','P6','P7','P8','P9']`.
   - `getPlayerTurnZone('P1', ctx.effectiveCourts, ctx.waitingQueue, ctx.playersPerMatch)` returns `{ zone: 'on-court', courtName: 'Court 1' }` (fixing the off-by-one bug where `'P1'` was previously `'on-deck'`), `'P5'` is `'on-deck'`, and `'P9'` is `'waiting'`.
2. **Priority & break filtering in single-court & multi-court:** `sittingOut` players are excluded from `waitingQueue`, and `priorityPlayers` in `waitingQueue` are promoted to the front.
3. **`<WaitingQueueChips />` markup:** When `onToggleWatchPlayer` is provided, each waiting chip renders as `<button type="button">` with `aria-pressed={watchedPlayer === player}` and `aria-label="Turn alert: Darwin (off)"` (specifically NOT ending in `win` or `wins`, preserving `getByRole('button', { name: /wins?$/i })` count `0` on `/watch`).

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/watchTurnContext.test.ts`
Expected: FAIL with module `./watchTurnContext` not found.

- [x] **Step 3: Implement `resolveWatchTurnContext`, `<WaitingQueueChips />`, `/watch` prop wiring, and `44px` + safe-area CSS**

1. Create `app/queue/lib/watchTurnContext.ts` implementing `resolveWatchTurnContext`.
2. In `app/watch/[sessionId]/LiveCourtStatus.tsx`:
   - Extract and export `<WaitingQueueChips />` so when `onToggleWatchPlayer` is passed, each chip renders as `<button type="button" className={...} aria-pressed={watchedPlayer === player} aria-label={\`Turn alert: \${player} (\${watchedPlayer === player ? 'on' : 'off'})\`} onClick={() => onToggleWatchPlayer(player)}>`, and falls back to `<span>` when read-only. Keep `.w-queue-more` (`+${waitingQueue.length - 8} waiting`) intact.
3. In `app/watch/[sessionId]/page.tsx`:
   - Update the turn-alert `useEffect` (`page.tsx:197-214`) to compute `const ctx = resolveWatchTurnContext(session); const zoneResult = getPlayerTurnZone(watchedPlayer, ctx.effectiveCourts, ctx.waitingQueue, ctx.playersPerMatch);`.
   - Pass `watchedPlayer={watchedPlayer}` and `onToggleWatchPlayer={toggleWatchPlayer}` to `<LiveCourtStatus />` at `page.tsx:767`.
   - In the single-court section (`!isTournament && !isSkilled && !isMultiCourt`, `page.tsx:860-887`), when `singleCourtTurnCtx.waitingQueue.length > 0`, render a `.w-section` (or subsection below `Upcoming Matches`) with `<WaitingQueueChips ... watchedPlayer={watchedPlayer} onToggleWatchPlayer={toggleWatchPlayer} />` so single-court spectators also see ETA pills and can arm turn alerts.
4. In `app/watch/[sessionId]/watch.css`:
   - Style `button.w-queue-chip--interactive` with `min-height: var(--tap-min, 44px)`, `padding: 6px 12px`, `font-family: inherit` so spectator tap targets meet the `44px` mobile floor.
   - Add safe-area inset padding to `.w-topbar` (`padding-top: calc(var(--sp-2, 8px) + var(--safe-top, 0px))`) and `.w-body` (`padding-bottom: calc(var(--sp-10, 48px) + var(--safe-bottom, 0px))`).

- [x] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- tests/watchTurnContext.test.ts tests/turnAlert.test.ts tests/queueEta.test.ts`
Expected: PASS on all suites.

- [x] **Step 5: Commit**

```bash
git add app/queue/lib/watchTurnContext.ts app/watch/[sessionId]/LiveCourtStatus.tsx app/watch/[sessionId]/page.tsx app/watch/[sessionId]/watch.css tests/watchTurnContext.test.ts
git commit -m "feat(watch): wire spectator turn alerts and 44px waiting chips across multi and single court"
```

---

### Task 6: Wire `"Flip Winner"` on `<AnalyticsDashboard />` & Persist Atomically to Firestore (Bug #6)

**Files:**
- Modify: `lib/sessionService.ts:385-470`
- Modify: `hooks/useSession.ts:82-93,524-550,626-638`
- Modify: `app/queue/page.tsx:645-660,2176-2185,2583-2590,2675-2685`
- Modify: `app/queue/QueueSystem.css:4762-4782`
- Modify: `app/queue/components/RecapCard/RecapModal.css:277-288`
- Modify: `tests/firestore.rules.test.ts`

**Interfaces:**
- Produces in `lib/sessionService.ts`:
  ```ts
  export type ReplaceHistoryOutcome =
    | { status: 'committed'; revision: number; commandId: string }
    | { status: 'not_found'; revision: number };

  export async function replaceHistoryEntry(
    sessionId: string,
    oldCommandId: string | undefined,
    updatedEntry: MatchHistoryEntry,
  ): Promise<ReplaceHistoryOutcome>;
  ```
- Extends `SessionActions` in `hooks/useSession.ts`:
  ```ts
  correctHistoryEntry: (entryId: number, updated: MatchHistoryEntry) => Promise<boolean>;
  ```

- [x] **Step 1: Write the failing Firestore rules & emulator transaction test for `replaceHistoryEntry` (including double-flip `A → B → A`)**

In `tests/firestore.rules.test.ts`, add a test case against the Firestore emulator asserting:
1. Direct `updateDoc` on `sessions/{sessionId}/history/{commandId}` is **denied** (`allow update: if false`).
2. Host atomic transaction (`delete` old `history/{oldCommandId}` + `update` parent `sessions/{sessionId}` with `{ revision: prevRevision + 1, updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp() }` + `set` new `history/{newCommandId}` with `{ ...flippedEntry, commandId: newCommandId, revision: prevRevision + 1 }`) **succeeds**.
3. Performing a **second flip** (`B → A`) using the newly created `newCommandId` (or querying by `where('id', '==', entry.id)`) **also succeeds** and preserves `entry.id` ordering.
4. A non-host / spectator attempting the same transaction is **denied**.

- [x] **Step 2: Run the rules test to verify our new helper test fails before `replaceHistoryEntry` exists**

Write a companion check in `tests/historyCorrection.test.ts` importing `replaceHistoryEntry` (or run `npm.cmd run test:rules` + `npm.cmd test -- tests/historyCorrection.test.ts`).
Run: `npm.cmd test -- tests/historyCorrection.test.ts`
Expected: FAIL with `replaceHistoryEntry is not exported from '@/lib/sessionService'`.

- [x] **Step 3: Implement `replaceHistoryEntry`, `session.correctHistoryEntry`, `<AnalyticsDashboard />` prop wiring, and `44px` / `16px` CSS fixes**

1. In `lib/sessionService.ts`, implement `replaceHistoryEntry(sessionId, oldCommandId, updatedEntry)`:
   - Authenticate via `ensureAuthenticated()`.
   - Resolve candidate old doc ref: if `oldCommandId` is provided, check `getDoc(doc(db, 'sessions', sessionId, 'history', oldCommandId))`; if missing or `!oldCommandId`, query `query(collection(db, 'sessions', sessionId, 'history'), where('id', '==', updatedEntry.id), limit(1))` to find the active doc ref (supporting rapid double-flips `A → B → A` even before snapshot propagation).
   - If no matching history doc exists, return `{ status: 'not_found', revision: 0 }`.
   - Inside `runTransaction(db, async tx => ...)`: read `sessionSnap` and `oldHistSnap`, verify `current.hostUid === user.uid` and `oldHistSnap.exists()`, compute `nextRevision = current.revision + 1` and `newCommandId = crypto.randomUUID()`, call `tx.delete(oldHRef)`, `tx.update(sRef, { revision: nextRevision, updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp() })`, and `tx.set(doc(db, 'sessions', sessionId, 'history', newCommandId), cleanNewEntry)`. Return `{ status: 'committed', revision: nextRevision, commandId: newCommandId }`.
2. In `hooks/useSession.ts`, add `correctHistoryEntry(entryId, updated)` chained through `revisionWriteChainRef.current`:
   - Optimistically updates `state.matchHistory` with `updated`, calls `replaceHistoryEntry(sessionId, updated.commandId, updated)`, updates `revisionRef.current` and `commandId: outcome.commandId` on commit, and returns `outcome.status === 'committed'`.
3. In `app/queue/page.tsx`:
   - Update `handleCorrectHistoryEntry(entryId: number, updated: MatchHistoryEntry)` (`page.tsx:651-656`) to:
     - Capture previous entry for rollback, apply optimistic `setHistoryOverrides` and `setLocalHistory` (and update `activeHistoryRef.current`),
     - If `session.sessionId` is active, await `session.correctHistoryEntry(entryId, updated)`; on commit, clear `historyOverrides[entryId]` once `rawActiveHistory` reflects the new `winner` (or store the returned `commandId` on the override), and on failure roll back `historyOverrides`/`localHistory` and show an error toast `"Could not save match correction. Check connection and try again."`
   - Pass `onCorrectHistoryEntry={canControl ? handleCorrectHistoryEntry : undefined}` to **all three** `<AnalyticsDashboard />` renders in `app/queue/page.tsx` (`lines 2176`, `2583`, and `2677`).
4. In `app/queue/QueueSystem.css:4763`, set `.history-flip-btn` to `min-height: var(--tap-min, 44px)` and `padding: 6px 12px`. Also fix `.recap-player-select` in `app/queue/components/RecapCard/RecapModal.css:277` to `font-size: 1rem` (`16px`) and `min-height: 44px`, and extend `tests/responsiveGuards.test.ts` input font-size check to include `select` and `textarea`.

- [x] **Step 4: Run unit, responsive guard, and Firestore rules tests**

Run: `npm.cmd test -- tests/historyCorrection.test.ts tests/responsiveGuards.test.ts` and `npm.cmd run test:rules`
Expected: PASS on all unit, responsive guard, and Firestore emulator security rules tests.

- [x] **Step 5: Commit**

```bash
git add lib/sessionService.ts hooks/useSession.ts app/queue/page.tsx app/queue/QueueSystem.css app/queue/components/RecapCard/RecapModal.css tests/historyCorrection.test.ts tests/firestore.rules.test.ts tests/responsiveGuards.test.ts
git commit -m "fix(history): wire Flip Winner in AnalyticsDashboard with atomic Firestore persistence"
```

---

### Task 7: Full-Stack Mobile E2E Verification of All Six Wired Flows

**Files:**
- Create: `tests/e2e/live-wiring-regressions.pw.ts`
- Modify: `tests/e2e/mobile-touch-targets.pw.ts`

**Interfaces:**
- Consumes: All 6 wired UI + Firestore flows from Tasks 1–6 at `390×844` mobile viewport against Firebase Auth + Firestore emulators.
- Produces: End-to-end regression gate proving zero disconnected props and `>= 44px` touch compliance on Setup, HostToolsSheet, AnalyticsDashboard, RecapModal, and `/watch/[sessionId]`.

- [x] **Step 1: Write `tests/e2e/live-wiring-regressions.pw.ts` covering all 6 bugs end-to-end**

Create `tests/e2e/live-wiring-regressions.pw.ts` (`viewport: { width: 390, height: 844 }`) with three focused tests:
1. **`smart paste + pre-session check-in + HostToolsSheet 1-tap late arrival` (Bugs #1, #3, #4):**
   - Navigate to `/queue?mode=doubles`, paste `'1. Ana (PAID)\n2. Ben ✅\n3. Cara\n4. Dan\n5. Eli\n6. Fay\nWaitlist:\n7. Ghost'` into paste textarea, click `"Add as Expected"`.
   - Assert `"Ghost"` is excluded, `Expected Arrivals (6)` appears, and `.checkin-btn` bounding box height `>= 44`.
   - Check in `Ana, Ben, Cara, Dan, Eli` (`5` checked in, `Fay` left in Expected Arrivals), click `Start Queue`.
   - Assert `localStorage.getItem(\`padq_late_arrivals_\${roomCode}\`)` equals `["Fay"]` (and `padq_late_arrivals_draft` is `null`).
   - Open `Host Tools` bottom sheet, assert `"Expected Late Arrivals (1)"` and `"Check in Fay"` button (`height >= 44`), click `"Check in Fay"`, and verify `"Fay"` appears in the live waiting queue (`PRIORITY`).
2. **`multi-court singles 3-win streak rotation & retroactive Flip Winner syncs to /watch and survives reload` (Bugs #2, #6):**
   - Start a 2-court singles session with 6 players (`S1..S6`), connect a `/watch/${roomCode}` spectator page.
   - Record 3 consecutive wins for `S1` on `Court 1`; assert `S1` stays on `Court 1` after wins 1 and 2, and rotates off `Court 1` into the waiting queue after win 3.
   - Switch host to `Stats` tab (`AnalyticsDashboard`), assert `.history-flip-btn` height `>= 44`, click `"Flip Winner"` on the latest match, assert host standings update immediately, reload `host`, assert flipped winner persists after reload, and assert spectator `/watch/${roomCode}` standings/history reflect the flipped winner live.
3. **`spectator turn alerts work in both multi-court and single-court /watch` (Bug #5):**
   - On `/watch/${roomCode}` (single-court doubles with 6 players `D1..D6`), assert `D5` chip renders in the waiting queue with `height >= 44`, click `D5` chip, assert `"Alert ON"` pill appears and persists across `viewer.reload()`, and verify `getByRole('button', { name: /wins?$/i })` still has count `0`.

Also add a `/watch` + `SetupView` check-in touch-target assertion pass in `tests/e2e/mobile-touch-targets.pw.ts`.

- [x] **Step 2: Run typecheck, unit tests, and Firestore rules suite**

Run:
- `npx.cmd tsc --noEmit`
- `npm.cmd test`
- `npm.cmd run test:rules`
Expected: Exit code `0` across all three commands.

- [x] **Step 3: Run the new E2E file and then the full Playwright E2E suite**

Run:
- `npm.cmd run test:e2e -- tests/e2e/live-wiring-regressions.pw.ts tests/e2e/mobile-touch-targets.pw.ts`
- `npm.cmd run test:e2e`
Expected: `100%` pass across all 13 Playwright `.pw.ts` files (`38/38` tests), zero regressions.

- [x] **Step 4: Commit**

```bash
git add tests/e2e/live-wiring-regressions.pw.ts tests/e2e/mobile-touch-targets.pw.ts
git commit -m "test(e2e): verify all six live-wired flows and 44px mobile targets end-to-end"
```
