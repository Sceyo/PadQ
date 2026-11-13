# 0003. Priority Return: Unified Return Flow & "Replace Called Player"

Status: accepted  
Date: 2026-10-22  
Context: PadQ V1 Queue & Player Availability Management (Supersedes ADR-0001)  

## Context
During live paddle/racket sessions, players stepping off the court do not need two distinct flags ("skip" vs "break"). The owner decided on a single, unified mechanism:
1. **Break**: Players take a break via the existing `sittingOut: string[]` field (UI label: "On break").
2. **Priority Return**: When a player indicates they are ready to return, they are owed a slot in the next available match/set.
3. **Decline when called**: If a player is assigned to an upcoming match but cannot play ("sit out on my turn"), they are replaced on that court by the next eligible waiting player, and the declining player moves to `sittingOut`.

## Options Considered
1. **Dual-Intent (`skipNext` flag + `sittingOut`)**: Proposed in ADR-0001. Rejected by owner: Adds unnecessary state surface and mental overhead. Declining a set is functionally equivalent to sitting out and returning when ready.
2. **Return to back of queue**: Simplest, but penalizes players who took a brief pause (e.g. bathroom, hydration) by making them wait behind everyone who arrived or finished later.
3. **Priority Return via `priorityPlayers: string[]` (Chosen)**:
   - One new top-level session field: `priorityPlayers: string[]` (order of return).
   - Top-level field avoids changing `PaddleState`, so existing sessions do not break.
   - Returning from `sittingOut` removes from `sittingOut`, appends to `priorityPlayers`, and places the player into the queue.
   - Match formation pulls priority players first, then removes them from `priorityPlayers`.
   - Mid-match sit-out does not happen during live rally play; instead, "replace called player" handles substitutions on formed, unscored matches.

## Decision
- Supersede ADR-0001.
- Introduce `priorityPlayers: string[]` as a top-level Firestore session field (Phase 5).
- **Multi-court rotation**: `ranked = [...priorityPlayers (eligible), ...rest]` in [`planMultiCourtResult`](../../app/queue/lib/multiCourtResult.ts).
- **Single-court doubles**: In [`advancePaddleState`](../../app/queue/lib/doublesEngine.ts), prepend eligible `priorityPlayers` to the pool the **next phase** draws from (`nextPhase === 'WINNERS' ? nextW1 : nextL1`), stripping them from the other pool and `waitingQueue` to keep pools pairwise disjoint, and pass them as `mustInclude` into [`smartSelectPool`](../../app/queue/lib/doublesEngine.ts) so penalty scoring cannot drop them (`INIT` phase keeps fixed slices and ignores priority).
- **Single-court King singles**: Returning players are placed at the head of `singlesState.queue` with `lastPlayedMap[name]` cleared so `selectChallenger` selects them next.
- **Single-court Pool singles (Q-A)**: Returning players are inserted at the **front** of `poolSinglesState.waitingQueue` (`addPlayerToPoolSinglesWaiting(state, name, true)`), giving them first promotion into `w1` at the next cycle boundary without distorting win/loss pool semantics.
- **Precedence over "Sit Next" (Q-B)**: Priority always wins. [`promoteSitNextTransition`](../../app/queue/lib/queueTransitions.ts) places a manually promoted non-priority player immediately **behind** any returning `priorityPlayers` in `queue` and engine pools.
- **Consumption across all modes**: When a match completes or forms with a priority player, [`consumePriority`](../../app/queue/lib/queueTransitions.ts) removes them from `priorityPlayers` (wired in multi-court `planMultiCourtResult` and single-court `handleSinglesMatch` / `handleDoublesMatch` in [`app/queue/page.tsx`](../../app/queue/page.tsx)). Sitting out again or being removed from the queue also removes them.
- **Replace Called Player (`replaceCalledPlayerTransition`)**:
  - **Auto-selection tiers** when `explicitReplacement` is omitted (first eligible candidate wins; eligible = in `players`, in `queue`, not in `sittingOut`, not already in the active match):
    - *Multi-court*: (1) `priorityPlayers` in order, (2) `queue` order.
    - *Single-court doubles*: (1) `priorityPlayers` in order, (2) same pool (`w1` or `l1`) as target, (3) `waitingQueue`, (4) the other pool, (5) `queue.slice(4)` fallback.
    - *Single-court singles*: (1) `priorityPlayers` in order, (2) engine pool/queue (`w1`/`l1`/`waitingQueue` or `singlesState.queue`/`waitingQueue`), (3) `queue.slice(2)` fallback.
  - **Disjoint pool updates**: Strips both `target` and `replacement` from `w1`, `l1`, and `waitingQueue` before inserting `replacement` at `target`'s index in `target`'s pool, preserving `checkPaddleStateConsistency`.
- **Unscored Match Guard & On-Court Sit-Out Routing (Phase 5b-4, Q-C)**:
  - *Single-court*: Replacement is disabled and blocked once `liveScore` has any points (`scoreA > 0 || scoreB > 0`) with tooltip/toast `"Cannot replace player after scoring has started"`.
  - *Multi-court (Q-C)*: Because multi-court cards do not track per-rally live scores, triggering replace on a court card prompts a one-tap confirmation (`"This match may already be underway. Replace anyway?"`) and records an in-memory Undo snapshot.
  - *Sit-out on an on-court player*: Toggling sit-out on a player currently on court routes to the replace flow (`handleMarkAbsent`) instead of removing them directly from `queue` while leaving them on court.

## Consequences
- **Positive**: Single clear concept for players and hosts. Solves the "lost turn" problem without origin pool complexity or extra flags.
- **Negative / Risks**: Host could enable queue-jumping if a player takes an extended break and returns with priority; mitigated by host controls.
- **Rollout**: Requires Firestore security rules update in Phase 5 before client writes `priorityPlayers`.

## Revisit When
If competitive rated matchmaking (V1.2) requires strict FIFO or algorithmic fatigue balancing over manual priority.
