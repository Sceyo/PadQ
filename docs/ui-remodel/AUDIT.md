# Phase 0 Audit: Mobile-First Frontend Remodel of PadQ

Date: Oct 26, 2026  
Branch: `UI-Overhaul` (cut from `main` @ 76de06b)  
Scope: Frontend presentation layer audit (no backend/engine/Firestore modifications)  
Rule: **Read-only audit & baseline validation before touching layout/styles.**

---

## 1. Executive Summary & Baseline Metrics

The codebase has been inspected and audited against the responsive guardrails ported from Watch Cebu (`tests/responsiveGuards.test.ts`).

- **TypeScript check (`tsc --noEmit`):** Clean (0 errors).
- **ESLint (`npm run lint`):** 0 errors, 70 warnings (mostly unused vars & legacy effect setState warnings).
- **Vitest Suite:** 34 test files passing (365 unit/scenario tests green, 37 Firestore rules skipped for emulator).
- **Responsive Guards:**
  - 2 Current Guards: Contrast passes (white on `#5457e0` is ≥4.5:1). `score-player-name` on `.score-player-name` caught legacy `white-space: nowrap; text-overflow: ellipsis;` in `QueueSystem.css:527` (tracked for Phase 1 fix).
  - 9 Target Guards: All failing as expected (`it.fails`), establishing our exact targets and offenders inventory.

---

## 2. Screen & Component Inventory

PadQ currently renders 4 primary screen modes orchestrated within `app/queue/page.tsx` (2,969 lines):

| Screen / Mode | Current Orchestration | Rendered Components | Mobile Defect / Ergonomic Issue |
|---|---|---|---|
| **Setup View** (`players.length === 0`) | `SetupView.tsx` | Roster panel, court count picker, player input list | Inputs under 16px trigger iOS auto-zoom; button sizes <44px. |
| **Single-Court Doubles** | `DoublesMatch.tsx` + `ScoreBoard.tsx` | `PlayerLabel`, `ScoreBoard`, inline `Form Teams`, inline winner selector, `.floating-confirm-wrap` | 1) Inline team toggling is confusing.<br>2) Plus button on left/stacked.<br>3) Applying result... status does nothing.<br>4) Confirm button renders below the fold. |
| **Multi-Court Doubles** (`courtSlots.length > 0`) | `CourtCard.tsx` (grid) + `CourtScoreModal.tsx` | `CourtTabs`, `CourtCard`, `CourtSwapModal`, `CourtScoreModal`, `waiting-players-list` | 1) CourtCard works well visually but modal overlays are fixed.<br>2) Mini user-replace icon (`10px`) is hard to tap.<br>3) Modals need viewport flex centering/sheet alignment. |
| **Singles Mode** (`gameMode === 'singles'`) | `Current Match` + `ScoreBoard.tsx` / `SinglesCourtCard.tsx` | `ScoreBoard`, `SinglesTable`, `PoolSinglesStatusPanel` | Inline scoring vs winner conflict. |
| **Spectator View** (`/watch/[sessionId]`) | `app/watch/page.tsx` + `ScoreBoard.tsx` | `ScoreBoard` (viewer mode), standings table | Viewer player names use `nowrap` + ellipsis causing clipped player text. |

---

## 3. Popup, Overlay & Dialog Inventory (Z-Index Scale Audit)

Target Z-Index Scale:
- `0`: Base content
- `100`: Sticky bars (header, navigation tabs)
- `200`: Bottom action bar (`ActionBar`, `ConfirmBar`)
- `1000`: Overlay backdrop (`OverlayHost`)
- `1100`: Dialogs & Bottom Sheets
- `1200`: Toast notifications

### Current Inconsistencies Identified:
| Popup / Overlay | Current Location | Current Z-Index | Target Action in Remodel |
|---|---|---|---|
| `.toast-notification` | `QueueSystem.css:761` | `9999` | Move to `1200` via `OverlayHost` |
| `.recap-modal-overlay` | `RecapModal.module.css:7` | `9999` | Move to `1000` backdrop, card at `1100` |
| `.floating-confirm-wrap` | `QueueSystem.css:1270` | `9500` | Consolidate into sticky bottom bar (`z-index: 200`) |
| `.confirm-overlay` | `QueueSystem.css:1238` | `9100` | Move to `OverlayHost` (`1000 / 1100`) |
| `.gear-menu-panel` | `QueueSystem.css:86` | `100` | Move to floating flex sheet on mobile (`1100`) |
| `.coord-overlay` | `QueueSystem.css:1840` | `900` | Deprecate/gate (legacy coordinator) |
| `.topright-controls` | `QueueSystem.css:54` | `20` | Consolidate into 52px AppHeader |

---

## 4. CSS Breakpoints & Viewport Violations

### Media Queries (`@media`) in `QueueSystem.css`:
Current widths in use:
- `480px` (lines 1980, 2012)
- `600px` (line 424)
- `640px` (lines 438, 778, 1272)
- `641px` (line 1290)
- `860px` (lines 452, 606, 1215, 1308)

**Action:** Standardize on **one mobile breakpoint (`768px`)** and one optional desktop two-column breakpoint (`1024px`).

### Viewport Heights (`100vh` without `dvh`):
- `html, body` (line 7): `min-height: 100vh;`
- `.queue-system` (line 33): `min-height: 100vh;`
- `.guide-modal` (line 622, 1378): `max-height: 85vh;`
- `.recap-modal-card` (`RecapModal.module.css:32`): `max-height: 90vh;`

**Action:** Adopt `100dvh` / `85dvh` throughout with `100vh` fallback.

### Inputs under 16px (Triggering iOS Zoom on Focus):
- `.input-group input` (`QueueSystem.css:73`): `font-size: 0.95rem` (~15.2px)
- `.live-form input` (`QueueSystem.css:1516`): `font-size: 0.85rem` (~13.6px)
- `.score-custom-input` (`QueueSystem.css:582`): `font-size: 0.85rem` (~13.6px)
- `.setup-field-input` (`SetupView.module.css:76`): `font-size: 0.9rem` (~14.4px)
- `.gear-recovery-input` (`QueueSystem.css:176`): `font-size: 0.85rem` (~13.6px)

**Action:** Set all mobile inputs to `font-size: 16px` (`1rem`) to prevent Safari zoom.

### Touch Targets under 44px:
- `.waiting-reorder-btn` (`QueueSystem.css:385`): `height: 24px; width: 24px`
- `.score-reset-btn` (`QueueSystem.css:571`): `height: 28px`
- `.help-btn` (`QueueSystem.css:60`): `height: 32px; width: 32px`
- `.recap-modal-close-btn` (`RecapModal.module.css:66`): `height: 32px; width: 32px`
- `.partner-player-btn` (`QueueSystem.css:1680`): `height: 38px`
- Absent replacement mini buttons: `UserX` at `10px` hit area

**Action:** Ensure all tap targets have at least `min-height: 44px; min-width: 44px` padding/hit area.

---

## 5. Banned Vocabulary Violations in Codebase

| Location | String | Replacement |
|---|---|---|
| `app/queue/components/DoublesMatch/DoublesMatch.tsx:137` | `<h3><Swords size={15} /> Form Teams</h3>` | `Edit teams` / `Now playing` |
| `app/queue/components/SitOutPanel/SitOutPanel.tsx:56-59` | `"Sit Out"` | `"Take a break"` |
| `app/queue/page.tsx:2333` | `<SitOutPanel ... />` | Rename UI label to `BreakPanel` / `Take a break` |
| `app/queue/components/CourtCard/CourtCard.tsx:60` | `"Can't play now: Replace ${p}"` | Keep accessible `"Can't play now"` |

---

## 6. Proposed Pure View-Model Adapters (`app/queue/lib/viewModels.ts`)

To decouple `app/queue/page.tsx` handlers from rendering and unify single vs multi-court layout:

```ts
export interface CourtTeamModel {
  side: 'A' | 'B';
  label: string;
  players: string[];
}

export interface CourtViewModel {
  id: string;
  name: string;
  status: 'playing' | 'ready' | 'waiting';
  teams: [CourtTeamModel, CourtTeamModel];
  score: {
    enabled: boolean;
    limit: number;
    scoreA: number;
    scoreB: number;
    hasStarted: boolean;
  };
  pendingWinner: 'A' | 'B' | null;
  canEdit: boolean;
}

export interface QueueViewModel {
  nextUp: Array<{ name: string; priority?: boolean }>;
  waiting: Array<{ name: string; etaLabel?: string }>;
  onBreak: Array<{ name: string }>;
}
```

---

## 7. Strangler Implementation & Delivery Gating

1. **Flag:** Add compile-time flag `mobileFirstShell: false` in `app/queue/lib/releaseConfig.ts`.
2. **Phase 1 Foundations:**
   - Create `app/queue/styles/tokens.css` (semantic colors, spacing, z-index, radii).
   - Export `viewport: Viewport = { themeColor: '#0b0d17', viewportFit: 'cover' }` in `app/layout.tsx`.
   - Implement `OverlayHost` (`Toast`, `Dialog`, `BottomSheet`) with keyboard trap, focus return, and `dvh` scroll lock.
   - Flip passing guard tests in `tests/responsiveGuards.test.ts`.

---

**Owner Sign-Off Gate:**  
Phase 0 complete. Awaiting user confirmation to begin Phase 1 Foundations on branch `UI-Overhaul`.
