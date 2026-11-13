# 0001. Dual-Intent Sit-Out: "Skip Next Game" vs "Take a Break"

Status: superseded by 0003  
Date: 2026-10-22  
Context: PadQ V1 Queue & Player Availability Management  

## Context
During live paddle/racket sessions, players step off the court for two reasons: a brief pause or an extended absence. Previously, `sittingOut` acted as a single toggle that removed players from `queue`, and returning always inserted players into `waitingQueue`, stripping origin pool information and causing confusion.

## Options Considered
1. **Single toggle with timer**: Auto-return after N minutes. Rejected: Inflexible.
2. **Reuse `sittingOut` for both**: Overloaded semantics led to lost origin pools.
3. **Dual-intent model (Initially proposed)**: "Skip Next Game" flag + "Take a Break".

## Decision
Initially proposed dual intent (`skipNext` flag + `sittingOut`).  
**Superseded by ADR-0003**: The owner decided against a separate `skipNext` flag. One unified mechanism is used: players take a break (`sittingOut`), and when returning, they enter the priority list (`priorityPlayers`) to fill the next available set. If they decline when called, they simply sit out again.

## Consequences
Superseded by ADR-0003.

## Revisit When
N/A — see ADR-0003.
