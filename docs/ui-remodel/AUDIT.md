# Phase 0 Audit: Mobile-First Frontend Remodel of PadQ

Date: Oct 26, 2026  
Branch: `UI-Overhaul` (synced with `origin/matchup-differential` @ `b18085a`)  
Scope: Frontend presentation layer audit (backend/engine/Firestore read-only)

---

## 1. Executive Summary & Baseline Metrics

The codebase has been inspected and audited on `UI-Overhaul` with the latest fixes from `matchup-differential` merged.

- **Git Base:** `UI-Overhaul` merged with `origin/matchup-differential`.
- **TypeScript (`tsc --noEmit`):** Clean (0 errors).
- **ESLint (`npm run lint`):** 0 errors, 71 warnings (unused vars & legacy effect setState warnings).
- **Vitest Suite:** 34 test files passing (367 unit/scenario tests green, 38 Firestore rules skipped for emulator).
- **Responsive Guards:**
  - `CURRENT guards`: 2 pass (`score player names wrap`, `contrast computed`).
  - `TARGET guards`: 9 failing as expected (`it.fails`), establishing exact baseline targets.

---

## 2. Screen & Component Inventory

| Screen / Mode | Current Orchestration | Rendered Components | Mobile Defect / Ergonomic Issue |
|---|---|---|---|
| **Setup View** (`players.length === 0`) | `SetupView.tsx` | Roster panel, court count picker, player input list | Inputs under 16px trigger iOS auto-zoom; button sizes <44px. |
| **Single-Court Doubles** | `DoublesMatch.tsx` + `ScoreBoard.tsx` | `PlayerLabel`, `ScoreBoard`, inline `Form Teams`, inline winner selector, `.floating-confirm-wrap` | 1) Inline team toggling is confusing.<br>2) Plus button on left/stacked.<br>3) Confirm bar rendered below screen.<br>4) Touch targets <44px. |
| **Multi-Court Doubles** (`courtSlots.length > 0`) | `CourtCard.tsx` (grid) + `CourtScoreModal.tsx` | `CourtCard` (Note: `CourtTabs` is legacy coordinator only, not in active V1 flow), `CourtSwapModal`, `CourtScoreModal`, `waiting-players-list` | 1) Modals not viewport-flex-centered.<br>2) Mini user-replace icon (10px) is hard to tap.<br>3) Match Score prompt flow needs bottom sheet alignment. |
| **Singles Mode** (`gameMode === 'singles'`) | `Current Match` + `ScoreBoard.tsx` / `SinglesCourtCard.tsx` | `ScoreBoard`, `SinglesTable`, `PoolSinglesStatusPanel` | Inline scoring vs winner conflict. |
| **Spectator View** (`app/watch/[sessionId]/page.tsx`) | `app/watch/[sessionId]/page.tsx` + `ScoreBoard.tsx` | `ScoreBoard` (viewer mode), standings table | Viewer player names use `nowrap` + ellipsis (`QueueSystem.css:1130`) causing clipped player text. |

---

## 3. Popup, Overlay & Dialog Inventory (Z-Index Scale Audit)

Target Z-Index Scale:
- `0`: Base content
- `100`: Sticky bars (header, navigation tabs)
- `200`: Bottom action bar (`ActionBar`, `ConfirmBar`)
- `1000`: Overlay backdrop (`OverlayHost`)
- `1100`: Dialogs & Bottom Sheets
- `1200`: Toast notifications

### Inconsistencies & Current Render State:
| Popup / Overlay | Current Location | Current Z-Index | Current Render Status / Action |
|---|---|---|---|
| `.toast-notification` | `QueueSystem.css:761` | `9999` | Move to `1200` via `OverlayHost` |
| `.recap-modal-overlay` | `RecapModal.module.css:7` | `9999` | Move to `1000` backdrop, card at `1100` |
| `.floating-confirm-wrap` | `QueueSystem.css:4477` / `DoublesMatch.tsx:202` | `9500` | **CONFIRMED RENDERED**: Rendered in `DoublesMatch.tsx:202` wrapping `.floating-confirm-bar`. Consolidate into sticky bottom bar (`z-index: 200`). |
| `.confirm-overlay` | `QueueSystem.css:1238` | `9100` | Move to `OverlayHost` (`1000 / 1100`) |
| `.gear-menu-panel` | `QueueSystem.css:86` | `100` | Move to floating flex sheet on mobile (`1100`) |
| `.coord-overlay` | `QueueSystem.css:1840` | `900` | Deprecate/gate (legacy coordinator) |
| `.topright-controls` | `QueueSystem.css:54` | `20` | Consolidate into 52px AppHeader |

---

## 4. CSS Breakpoints, Viewport & Sizing Audit

### Media Queries (`@media`) in `QueueSystem.css`:
Current widths in use:
- `480px` (lines 1980, 2012)
- `600px` (line 424)
- `640px` (lines 438, 778, 1272)
- `641px` (line 1290)
- `860px` (lines 452, 606, 1215, 1308)

**Action:** Standardize strictly on **one mobile breakpoint (`768px`)** and one optional desktop two-column breakpoint (`1024px`).

### Viewport Heights (`100vh` without `dvh`):
- `html, body` (`QueueSystem.css:7`): `min-height: 100vh;`
- `.queue-system` (`QueueSystem.css:33`): `min-height: 100vh;`
- `.guide-modal` (`QueueSystem.css:622`, `1378`): `max-height: 85vh;`
- `.recap-modal-card` (`RecapModal.module.css:32`): `max-height: 90vh;`

**Action:** Adopt `100dvh` / `85dvh` throughout with `100vh` fallback.

### Inputs under 16px (11 Selectors Identified in `QueueSystem.css`):
1. `.input-group input`: `font-size: .95rem` (15.2px)
2. `.live-form input`: `font-size: .83rem` (13.28px)
3. `.score-custom-input`: `font-size: .8rem` (12.8px)
4. `.session-join-input`: `font-size: 0.9rem` (14.4px)
5. `.session-join-input::placeholder`: `font-size: 0.75rem` (12px)
6. `.input-group input`: `font-size: 0.88rem` (14.08px)
7. `.setup-field-input`: `font-size: 0.85rem` (13.6px)
8. `.skilled-inline-input`: `font-size: .84rem` (13.44px)
9. `.skilled-filter-input`: `font-size: .83rem` (13.28px)
10. `.skilled-new-input`: `font-size: .83rem` (13.28px)
11. `.gear-recovery-input`: `font-size: .8rem` (12.8px)

**Action:** Set all mobile inputs to `font-size: 16px` (`1rem`) to prevent Safari zoom.

### Touch Targets under 44px:
- `.waiting-reorder-btn` (`QueueSystem.css:385`): `24px × 24px`
- `.score-reset-btn` (`QueueSystem.css:571`): `28px`
- `.help-btn` (`QueueSystem.css:60`): `32px × 32px`
- `.recap-modal-close-btn` (`RecapModal.module.css:66`): `32px × 32px`
- `.partner-player-btn` (`QueueSystem.css:1680`): `38px`
- Absent replacement mini buttons: `UserX` at `10px` hit area

**Action:** Ensure all tap targets have at least `min-height: 44px; min-width: 44px` padding/hit area.

### Icon-Only Buttons Missing Accessible Name (`aria-label` / `title`):
- `ScoreBoard.tsx`: `<button className="score-custom-ok" onClick={applyCustomLimit}><Check size={12} /></button>` (missing `aria-label`)
- `SetupView.tsx`: `<button onClick={onAddPlayer} className="add-btn"><UserPlus size={15} /></button>` (missing `aria-label`)

### Non-Button Elements with `onClick`:
- `CourtScoreModal.tsx:91`: `<div className={styles.overlay} onClick={onCancel}>` (Backdrop)
- `CourtSwapModal.tsx:67`: `<div className={styles.overlay} onClick={onClose}>` (Backdrop)
- `PlayerActionMenu.tsx:51`: `<div className="player-menu-backdrop" onClick={onClose}>` (Backdrop)
- `UserGuideModal.tsx:54`: `<div className="modal-overlay" onClick={handleClose}>` (Backdrop)
- `WinnerModal.tsx:25`: `<div className="modal-overlay" onClick={onClose}>` (Backdrop)
- `page.tsx:2663`: `<div className="waiting-reorder-btns" onClick={e => e.stopPropagation()}>` (Container)

---

## 5. Banned Vocabulary Violations in Codebase

| Location | String | Replacement |
|---|---|---|
| `DoublesMatch.tsx:137` | `<h3><Swords size={15} /> Form Teams</h3>` | `Edit teams` / `Now playing` |
| `SitOutPanel.tsx:32` | `title="Sit out player"` | `"Take a break"` |
| `page.tsx:2270` | `<SitOutPanel ... />` | Rename UI label to `Take a break` |
| `CourtCard.tsx:60` | `"Can't play now: Replace ${p}"` | Keep accessible `"Can't play now"` |

---

## 6. Single-vs-Multi Court Forks in `page.tsx` (21 Identified)

| Line | Branch Condition | Purpose |
|---|---|---|
| 489 | `if (courtSlots.length === 0) return [];` | Get on-court players |
| 515 | `isSingleCourtReplaceBlocked = courtSlots.length === 0 && ...` | Prevent replace if scoring active on single court |
| 575 | `const defs = courtSlots.length > 0 ...` | Generate skilled court defs |
| 607 | `if (courtSlots.length > 0) return waitingPlayers;` | Waiting queue determination |
| 810 | `const defs = courtSlots.length > 0 ...` | Skilled matchmaking fill |
| 824 | `const isPlayerOnCourt = courtSlots.length > 0 ...` | Toggle sit out safety check |
| 2205 | `courtSlots.length === 0` | Singles default queue layout |
| 2214 | `courtSlots.length > 0` | Singles multi-court layout |
| 2276 | `courtSlots.length > 0` | Partner panel toggle |
| 2284 | `courtSlots.length > 0` | Score mode toggle |
| 2320 | `courtSlots.length === 0` | Doubles paddle status diagnostics |
| 2323 | `courtSlots.length === 0` | Singles status diagnostics |
| 2330 | `courtSlots.length > 0` | Multi-court diagnostics summary |
| 2492 | `courtSlots.length > 0` | Singles multi-court card grid |
| 2531 | `formatEtaLabel(..., courtSlots.length > 0)` | Singles multi-court ETA calculation |
| 2543 | `courtSlots.length === 0 && queue.length >= 2` | Singles single-court match board |
| 2624 | `courtSlots.length > 0 ? (Multi-court) : (Single-court)` | Main doubles match section split |
| 2659 | `formatEtaLabel(..., courtSlots.length > 0)` | Doubles multi-court ETA calculation |

---

## 7. `app/queue/page.tsx` Handler Map (Grouped by Concern)

### A. Match Flow & Result Life Cycle:
- `handleDoublesMatch` (L1225): Records doubles winner, updates career stats, calls `advancePaddleState`
- `handleSinglesMatch` (L1014): Records singles winner, calls `advanceSinglesState`
- `handleCourtMatch` (L1332): Multi-court match completion via `planMultiCourtResult`
- `handleCourtWinClick` (L1457): Multi-court winner trigger (opens score modal or completes)
- `handleSinglesCourtWinClick` (L1477): Singles multi-court winner trigger
- `handleConfirmCourtScore` (L1497): Saves court score from `CourtScoreModal`
- `handleScoreChange` (L510): Syncs live scoreboard state to session
- `handleToggleScorePrompt` (L222): Toggles Match Scores on/off
- `handleUndoLastMatch` (L877): Restores snapshot for queue, paddleState, courtSlots, sittingOut

### B. Queue & Player Operations:
- `handleMarkAbsent` (L924): Replaces called player via `replaceCalledPlayerTransition`
- `handleConfirmSub` (L933): Confirms substitute player
- `handleToggleSitOut` (L820): Moves player to/from `sittingOut` via `toggleSitOutTransition`
- `handleSwapPlayers` (L1515): Swaps team positions on a court
- `handleMoveWaitingPlayer` (L1621): Reorders waiting queue manually
- `handlePartnerPairsChange` (L1645): Updates locked partner pairs

### C. Host Tools & Live Management:
- `handleAddPlayerLive` (L1587): Adds new player to active session roster and queue
- `handleStartQueue` (L681): Initializes session from setup screen
- `handleFullReset` / `handleHardReset` (L1666, 1668): Clears or ends session
- `handleGoLive` (L503): Toggles session live state
- `showToast` / `showMatchToast` / `dismissToast` / `handleToastUndo` (L405-454): Toast notifications

### D. Setup & Roster Management:
- `handleSaveToRoster` (L1739): Saves current players to local roster
- `handleRosterToggle` / `handleSelectAllRoster` / `handleAddFromRoster` (L1745-1761): Roster selection in setup
- `handleRemoveFromRosterUI` / `handleSetRosterSkill` (L1770, 1776): Roster editing

---

## 8. Baseline Responsive Offender Counts (`tests/fixtures/responsive-baseline.json`)

```json
{
  "nonStandardBreakpoints": ["480px", "600px", "640px", "641px", "860px"],
  "inputsUnder16px": 11,
  "buttonsUnder44px": 6,
  "vhWithoutDvh": 4,
  "zindexViolations": 6,
  "bannedVocabularyOccurrences": 4
}
```

---

## 9. Strangler Implementation Plan & Safety Gates

1. **Kill Switch:** `V1_RELEASE.mobileFirstShell = false` in `releaseConfig.ts`.
2. **Phase 1 Foundations:**
   - Tokens in `app/queue/styles/tokens.css`.
   - `viewport` export (`themeColor`, `viewportFit: 'cover'`) in `app/layout.tsx` + safe-area insets.
   - `OverlayHost` (`Toast`, `Dialog`, `BottomSheet`) with focus trap, Escape, scroll lock.
   - Guard test ratchet committed in `tests/fixtures/responsive-baseline.json`.
