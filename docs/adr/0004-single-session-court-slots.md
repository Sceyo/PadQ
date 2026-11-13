# 0004. Multi-Court Architecture: Single-Session `courtSlots`

Status: accepted  
Date: 2026-10-22  
Context: PadQ V1 Multi-Court Session Architecture  

## Context
In early PadQ prototypes, multi-court support was explored through two competing architectures:
1. **Multi-Session Coordinator (`padq_court_group` / `CourtTabs`)**: Multiple independent Firestore sessions (one per court), bound together only in host device `localStorage`.
2. **Single-Session Court Slots (`courtSlots: CourtSlot[]`)**: A single Firestore session holding an array of court slots (`CourtSlot[]`, defined in `lib/sessionService.ts`), sharing a single queue, player roster, and real-time listener.

The repo documentation in `CLAUDE.md` had retained stale descriptions of the multi-session coordinator, causing ambiguity about the production V1 target.

## Options Considered
1. **Multi-Session Coordinator**:
   - Pros: Isolated session documents.
   - Cons: Fragile localStorage synchronization across tabs; spectators on `/watch` cannot see other courts without switching room codes; cannot coordinate a single unified queue across courts.
2. **Single-Session `courtSlots` (Chosen)**:
   - Pros: Unified queue and roster; atomic match planning via `planMultiCourtResult`; live spectators see all courts simultaneously on `/watch/[sessionId]`; simple data model and zero multi-tab desync risk.
   - Cons: Session document updates whenever any court finishes; mitigated by lightweight payload and Firebase Spark free tier limits.

## Decision
- Standardize PadQ V1 multi-court exclusively on **Single-Session `courtSlots`**.
- Keep `CourtSlot` interface in `lib/sessionService.ts` (`id: string; name: string; onCourt: string[]`).
- Leave the legacy court coordinator turned off (`showLegacyCourtCoordinator: false` in `releaseConfig.ts`).
- Update `CLAUDE.md` to reflect single-session `courtSlots` as the sole supported multi-court architecture.

## Consequences
- **Positive**: Single room code, unified queue, synchronized spectator `/watch` views, deterministic tests.
- **Negative / Risks**: Must ensure Firestore rules allow `courtSlots` updates and validate schema correctly.

## Revisit When
If an enterprise venue requires 10+ courts with partitioned sub-administrators per court, which might warrant distributed sessions.
