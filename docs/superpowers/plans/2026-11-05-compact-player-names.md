# Compact Player Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically format multi-word player names on display (e.g. `Anna Leigh Waters` → `A.L. Waters`, `Quang Dong` → `Q. Dong`) across all mobile court cards, queue chips, spectator views, and leaderboard screens while strictly preserving the raw full name in state and database.

**Architecture:** Pure display-layer formatting via a centralized `formatDisplayName` helper integrated into `PlayerLabel`, `/watch` spectator chips, and `AnalyticsDashboard`, keeping `title` and `aria-label` tooltips/announcements holding the full raw name.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-compact-player-names-design.md`

## Global Constraints

- Never mutate underlying player identity strings in state, Firestore payloads, or engine calculations.
- Zero changes to `firestore.rules`.
- Preserve `>= 44px` mobile touch targets and accessibility.

## Review Focus

- Single-word names (`Ben`) must never append dots or truncate.
- Names with leading, trailing, or multiple whitespace (`"  Quang   Dong  "`) must normalize cleanly to `"Q. Dong"`.
- Names with hyphenated first names (`Jean-Luc Picard`) should abbreviate the first token (`J. Picard`).
- Full names must be preserved in HTML `title` attributes for tooltips on desktop/hover and `aria-label` for accessibility.
- Interactive handlers (`onSelectPlayer`, `onWin`, `onToggleWatchPlayer`) must pass the raw player name, never the formatted display string.

---

### Task 1: Create `formatDisplayName` Utility with Comprehensive Unit Tests

**Files:**
- Create: `app/queue/lib/nameFormatter.ts`
- Create: `tests/nameFormatter.test.ts`

**Interfaces:**
```ts
export function formatDisplayName(fullName: string): string;
```

- [x] **Step 1: Write failing unit tests for `formatDisplayName`**

In `tests/nameFormatter.test.ts`:
1. Single name: `'Ben'` → `'Ben'`, `'Madonna'` → `'Madonna'`
2. Two-part name: `'Quang Dong'` → `'Q. Dong'`, `'John Doe'` → `'J. Doe'`
3. Three-part name: `'Anna Leigh Waters'` → `'A.L. Waters'`, `'Ben Johns Smith'` → `'B.J. Smith'`
4. Four-part name: `'John Fitzgerald Kennedy Junior'` → `'J.F.K. Junior'`
5. Whitespace resilience: `'  Quang   Dong  '` → `'Q. Dong'`
6. Empty or non-string input: `''` → `''`

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/nameFormatter.test.ts`
Expected: FAIL with module `./nameFormatter` not found.

- [x] **Step 3: Implement `formatDisplayName` in `app/queue/lib/nameFormatter.ts`**

Implement:
```ts
export function formatDisplayName(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') return '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  const tokens = trimmed.split(/\s+/);
  if (tokens.length <= 1) return tokens[0];
  if (tokens.length === 2) {
    const firstInitial = tokens[0][0].toUpperCase();
    return `${firstInitial}. ${tokens[1]}`;
  }
  const surname = tokens[tokens.length - 1];
  const givenInitials = tokens.slice(0, -1).map(t => `${t[0].toUpperCase()}.`).join('');
  return `${givenInitials} ${surname}`;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- tests/nameFormatter.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add app/queue/lib/nameFormatter.ts tests/nameFormatter.test.ts
git commit -m "feat(name): add formatDisplayName utility with unit test suite"
```

---

### Task 2: Integrate `formatDisplayName` into `PlayerLabel` and Host Queue Screens

**Files:**
- Modify: `app/queue/components/atoms/PlayerLabel.tsx`
- Modify: `app/queue/components/SingleCourtScreen/SingleCourtScreen.tsx`
- Test: `tests/playerLabel.test.tsx`

**Interfaces:**
`PlayerLabel` continues to accept `name: string`, `statsMap?: Record<string, PlayerStat>`, `showRank?: boolean`.

- [x] **Step 1: Write failing component test for `PlayerLabel` display abbreviation**

In `tests/playerLabel.test.tsx`:
Assert that `<PlayerLabel name="Anna Leigh Waters" />` renders `A.L. Waters` in visible text and contains `title="Anna Leigh Waters"`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/playerLabel.test.tsx`
Expected: FAIL (renders "Anna Leigh Waters" instead of "A.L. Waters").

- [x] **Step 3: Update `PlayerLabel.tsx` to use `formatDisplayName`**

In `app/queue/components/atoms/PlayerLabel.tsx`:
```tsx
import React from 'react';
import type { PlayerStat } from '../../lib/types';
import { RankBadge } from './RankBadge';
import { StreakBadge } from './StreakBadge';
import { formatDisplayName } from '../../lib/nameFormatter';

export const PlayerLabel: React.FC<{
  name: string;
  statsMap?: Record<string, PlayerStat>;
  showRank?: boolean;
}> = ({ name, statsMap, showRank = false }) => {
  const s = statsMap?.[name];
  const displayName = formatDisplayName(name);
  return (
    <span className="player-label" title={name}>
      {displayName}
      {s && <StreakBadge streak={s.streak} />}
      {s && showRank && <RankBadge rank={s.rank} />}
    </span>
  );
};
```
In `SingleCourtScreen.tsx`, ensure `ScoreRow` and `GameOver` banners format names with `formatDisplayName` while preserving raw names in action dispatches.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- tests/playerLabel.test.tsx tests/singleCourtScreen.test.tsx tests/courtScoreModal.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add app/queue/components/atoms/PlayerLabel.tsx app/queue/components/SingleCourtScreen/SingleCourtScreen.tsx tests/playerLabel.test.tsx
git commit -m "feat(ui): format compact player names in PlayerLabel and SingleCourtScreen"
```

---

### Task 3: Integrate `formatDisplayName` into Spectator View & Analytics Dashboard

**Files:**
- Modify: `app/watch/[sessionId]/LiveCourtStatus.tsx`
- Modify: `app/watch/[sessionId]/page.tsx`
- Modify: `app/queue/components/AnalyticsDashboard/AnalyticsDashboard.tsx`
- Test: `tests/spectatorNameFormatting.test.tsx`

- [x] **Step 1: Write failing component tests for spectator and analytics compact names**

In `tests/spectatorNameFormatting.test.tsx`:
1. `<WaitingQueueChips />` with `waitingQueue={['Quang Dong', 'Anna Leigh Waters']}` renders visible text `Q. Dong` and `A.L. Waters`, but `aria-label` retains `Turn alert: Quang Dong (off)` and `Turn alert: Anna Leigh Waters (off)`.
2. `<AnalyticsDashboard />` renders `formatDisplayName(s.name)` in the table rows and cards while retaining `title={s.name}`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/spectatorNameFormatting.test.tsx`
Expected: FAIL.

- [x] **Step 3: Update `LiveCourtStatus.tsx`, `/watch/[sessionId]/page.tsx`, and `AnalyticsDashboard.tsx`**

1. In `app/watch/[sessionId]/LiveCourtStatus.tsx`:
   - Import `formatDisplayName` from `@/app/queue/lib/nameFormatter`.
   - In `<WaitingQueueChips />`, display `formatDisplayName(player)` while keeping `player` in `aria-label`, `isWatched`, and `onToggleWatchPlayer`.
   - In `w-player-name`, display `formatDisplayName(player)` with `title={player}`.
2. In `app/watch/[sessionId]/page.tsx`:
   - In match history list and break chips, format player display names with `formatDisplayName`.
3. In `app/queue/components/AnalyticsDashboard/AnalyticsDashboard.tsx`:
   - In table rows, player cards, and frequency bars, render `formatDisplayName(s.name)` with `title={s.name}`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- tests/spectatorNameFormatting.test.tsx tests/analyticsDashboard.test.tsx tests/watchStandings.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add app/watch/[sessionId]/LiveCourtStatus.tsx app/watch/[sessionId]/page.tsx app/queue/components/AnalyticsDashboard/AnalyticsDashboard.tsx tests/spectatorNameFormatting.test.tsx
git commit -m "feat(watch): apply compact display names to spectator view and analytics dashboard"
```

---

### Task 4: Full Verification Across Unit, Security Rules, and Playwright E2E

**Files:**
- Test: Run full typecheck, Vitest, Firestore rules, and Playwright E2E suite.

- [ ] **Step 1: Run TypeScript typecheck**

Run: `npx.cmd tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run Vitest unit & integration test suite**

Run: `npm.cmd test -- --run`
Expected: 100% pass across all test files.

- [ ] **Step 3: Run Firestore security rules emulator suite**

Run: `npx.cmd firebase --config firebase.e2e.json emulators:exec --only firestore "npx.cmd vitest run tests/firestore.rules.test.ts"`
Expected: 39 passed / 39 tests.

- [ ] **Step 4: Run Playwright E2E test suite**

Run: `npm.cmd run test:e2e`
Expected: 39 passed / 39 tests across all 13 files.

- [ ] **Step 5: Final plan sync and wrap-up**

Check off all task checkboxes in `docs/superpowers/plans/2026-11-05-compact-player-names.md`.
