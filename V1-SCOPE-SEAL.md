# PADQ V1 Scope Seal

**Release branch:** `v1-prod-hardening`

**Scope:** PADQ V1.0 on Firebase Spark and Vercel Hobby

This document records the boundary between the features included in V1.0 and
the implemented features that remain unavailable until a later release.

## Included in V1.0

| Area | V1 behavior | Limit |
|---|---|---|
| Session type | Singles and doubles | Default queue only |
| Event size | Shared player and court management | 30 players, 3 courts |
| Partners | Host can lock partners from the active queue | `floor(players / 2)` pairs |
| Spectators | Room-code or QR access | Read-only |
| Multi-court view | Live Court Status, selected court, waiting queue, next assignment | No point-by-point scores |
| Results | Host records the winning team for each court | One authoritative result per revision |
| History and performance | Loaded only when requested | Computed in the browser |
| Single-court scoring | Optional point-by-point scoring | Host controlled |

## Sealed until a later release

- Tournament, double-elimination, Play-All, and skilled matchmaking.
- Viewer PIN setup and the legacy independent-court coordinator.
- Multi-host and delegated scorekeeper access.
- Point-by-point scoring for multi-court sessions.
- Permanent accounts and cross-device host recovery.
- Cross-room public leaderboards and deep live analytics.
- Firebase Storage, Cloud Functions, Cloud Run, scheduled jobs, managed TTL,
  backups, and other billing-dependent services.

## Enforcement evidence

The V1 boundary is enforced at several layers:

1. `V1_RELEASE` fixes the default queue, maximum player/court counts, and hides
   deferred setup controls.
2. Route handling accepts only singles or doubles and ignores injected deferred
   mode parameters.
3. Host and spectator interfaces omit deferred controls; multi-court sessions
   expose winner-only result actions.
4. Firestore security rules reject deferred modes, fields, oversized player
   lists, and more than three courts.
5. Unit, rules, and browser tests verify the boundary, including a browser test
   that attempts to activate deferred features through URL parameters.

The complete implementation remains preserved on
`codex/all-features-v1-archive`. Sealing means unavailable in V1.0; it does not
mean the underlying work has been deleted.
