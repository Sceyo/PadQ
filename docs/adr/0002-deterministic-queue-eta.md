# 0002. Deterministic Queue Wait Time (ETA) Formula

Status: accepted  
Date: 2026-10-22  
Context: PadQ V1 Queue Visibility & Player Expectations  

## Context
Waiting players on mobile phones frequently wonder when their next match will be. A misleading continuous clock timer (e.g. "estimated wait: 14 mins") generates frustration when games run long or courts stall. Furthermore, time-based estimation requires telemetry or Firestore timestamp tracking that adds cost and schema complexity.

Single-court doubles queues already have a structured ordering (next 4 players on deck, then remainder ordered by court roster). Multi-court sessions share a FIFO waiting queue feeding several parallel courts.

## Options Considered
1. **Clock-based elapsed time (EMA / Poisson process)**: Requires recording `matchStartedAt` in Firestore, tracking historical match durations per court, and sending telemetry. Rejected for V1: Violates $0 Firebase budget principles, adds unnecessary complexity, and is prone to false precision.
2. **Deterministic Match Count ETA (Chosen)**:
   - For multi-court: $m = \lceil k / S \rceil$ where $k$ is the 1-based index in the eligible waiting queue (skipping/break players excluded) and $S$ is players per match ($S = 4$ for doubles, $S = 2$ for singles).
   - Display: If $m = 1$, display `"Up next"`; if $m > 1$, display `"~m matches"`.
   - For single-court: Only display `"On deck"` for the immediate next group of players.

## Decision
Implement pure function `estimateMatchesAhead(k: number, s: number): number`:
- $m = \lceil k / S \rceil$ (for $k \ge 1, S \ge 1$).
- Pure computation with no async calls, no Firestore dependencies, and no timers.
- Single-court displays `"On deck"` for the first $S$ players, leaving further positions unlabeled.
- Multi-court displays `"Up next"` ($m = 1$) or `"~m matches"` ($m > 1$).

## Consequences
- **Positive**: 100% deterministic, testable with simple unit boundary tests, zero Firestore write overhead, honest and intuitive for players.
- **Negative / Risks**: Does not account for sudden court abandonments or concurrent match finishes; labeled explicitly with `~` (approximation).

## Revisit When
Post-V1 if telemetry demonstrates significant player demand for clock-based ETAs and multi-venue analytics are enabled.
