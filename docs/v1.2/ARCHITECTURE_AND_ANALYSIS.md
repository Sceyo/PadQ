# Skill-Aware Matchmaking: Technical Analysis & System Architecture (V1.2)

**Release Target:** PAD-Q V1.2  
**Feature:** Skill-Aware Matchmaking (Automatic queue grouping into Beginner, Intermediate, and Advanced brackets with snake-draft court assignment)  
**Branch:** `Matchmaking-skill-based`  
**Guidelines Followed:**  
- [Analysis & Investigation Guidelines](file:///c:/Users/francis/Desktop/Claude/claude-md-masterclass/claude-md-masterclass/.claude/guidelines/analysis.md)
- [Architecture & System Design Guidelines](file:///c:/Users/francis/Desktop/Claude/claude-md-masterclass/claude-md-masterclass/.claude/guidelines/architecture.md)

---

# Part 1: Technical Analysis (per `analysis.md`)

## Question
What is the structural and behavioral state of Skill-Aware Matchmaking in the repository, how was it implemented on `all-features-archive`, what gaps exist between that legacy implementation and PAD-Q's hardened V1 architecture, and what changes are required to deliver V1.2 cleanly?

## Bottom Line
The pure algorithmic engine (`app/queue/lib/skilledMatchmakingEngine.ts`) and UI bracket manager (`app/queue/components/SkilledView/SkilledView.tsx`) are intact, fully tested (42/42 tests passing), and preserved in our tree. However, the legacy integration stored court assignments purely in ephemeral React state without syncing to Firestore `courtSlots` or passing database rules—meaning spectators could not see live matches and host refreshes wiped active games. Modernizing for V1.2 requires connecting the engine output to authoritative `courtSlots`, updating Firestore rules for `queueMode: 'skilled'`, and preserving backward compatibility with the default queue. (**Confidence: High — 95%**)

---

## Evidence

1. **Pure Engine Availability & Test Coverage:**
   - `app/queue/lib/skilledMatchmakingEngine.ts`: Pure functional engine implementing priority cascade P1 (pure), P2 (adjacent fill), P3 (split fill), P3B (cross-bracket snake draft), starvation overrides, and idle-court rest management.
   - `tests/skilledMatchmakingEngine.test.ts`: All 42 unit tests pass green in 28ms under `vitest`.
2. **Snake-Draft Team Ordering:**
   - `app/queue/lib/skilledMatchmakingEngine.ts:166-174`: `snakeOrder(selected, sq)` sorts selected players descending by skill level ($3 \to 1$) and maps them to `[s[0], s[3], s[1], s[2]]`, placing `#1 & #4` on Team A and `#2 & #3` on Team B.
3. **Bracket Persistence:**
   - `lib/sessionService.ts:783-792`: `loadSkilledBrackets()` and `saveSkilledBrackets()` persist `padq_skilled_brackets` to browser `localStorage`.
4. **Current Launch Seals:**
   - `app/queue/lib/releaseConfig.ts:5-13`: `V1_RELEASE` hardcodes `queueMode: 'default'`, `showQueueModeSelector: false`, and `showSkillTagging: false`.
   - `app/queue/page.tsx:1545-1555`: The mode selector UI (`<div className="mode-selector">`) is gated behind `V1_RELEASE.showQueueModeSelector`.
5. **Database Boundary Lockout:**
   - `firestore.rules:254-255`: `validSession(data)` requires `data.queueMode == 'default'`.
   - `firestore.rules:295-296`: `validSessionUpdate(data)` requires `data.queueMode == 'default'`.
   - Any client attempting to save `queueMode: 'skilled'` with current rules will fail with `PERMISSION_DENIED`.
6. **Legacy Multi-Court State Desync:**
   - `all-features-archive:app/queue/page.tsx:618-622`: Legacy match result handler called `session.commitMatchResult({ queue }, entry)`, syncing only the waiting queue to Firestore. It never projected `skilledState.courts` into `courtSlots`, leaving the watch page (`app/watch/[sessionId]/page.tsx`) blank.

---

## Analysis

### Observations (Empirical Facts)
- The algorithmic core is complete, modular, and does not depend on React or Firebase.
- The UI component `SkilledView.tsx` compiles cleanly and matches design system styling.
- The current Firestore rules strictly enforce `queueMode == 'default'`.
- The multi-court Live Court Status spectator view introduced in V1 (`app/watch/[sessionId]/page.tsx`) listens exclusively to `courtSlots: CourtSlot[]`.

### Inferences (Logical Deductions)
- Merely toggling `V1_RELEASE.showQueueModeSelector = true` without updating `firestore.rules` will cause session creation or mode-switching writes to crash the client.
- Simply copying the legacy `page.tsx` integration from `all-features-archive` would introduce a major regression: spectators watching on mobile devices wouldn't see live court assignments because the legacy skilled mode never updated `courtSlots`.
- To deliver V1.2 cleanly, the engine's `skilledState.courts` must project into standard `CourtSlot[]` (`{ id, name, onCourt: [A1, A2, B1, B2] }`) during every rotation.

### Unknowns & Risks
- *Host crash recovery:* If the host's browser crashes mid-match in skilled mode, can the active bracket queue be reconstructed safely from `courtSlots` and `localStorage`?
- *Rule evaluation complexity:* Does adding `queueMode == 'skilled'` push `firestore.rules` beyond the 1,000-expression evaluation limit?

---

## Recommendations

| # | Action | Impact | Effort | Risk / Tradeoff |
|---|---|:---:|:---:|---|
| **1** | **Bridge Engine to `courtSlots`** | Critical | Medium | Ensures spectators see real-time skilled matches; eliminates dual state model. |
| **2** | **Update `firestore.rules` for `skilled`** | Critical | Low | Allows `queueMode in ['default', 'skilled']`; must verify against 1000-expr limit. |
| **3** | **Unseal Setup & Mode Selector** | High | Low | Exposes Skilled mode in setup and live gear controls when enabled. |
| **4** | **Add End-to-End Integration Tests** | High | Medium | Prevents regression across 1–3 courts with 30 players. |

## What I Did Not Check
- Behavior of live spectator camera QR joining specifically while a skilled match is mid-point.
- Performance of bracket assignment when all 30 players are in a single bracket (e.g. 30 Beginners, 0 Advanced).

---
---

# Part 2: Architecture & System Design (per `architecture.md`)

## 1. Context, Goals & Constraints

### Business & Functional Goals
1. Allow session organizers to tag players into three skill tiers: **Beginner**, **Intermediate**, and **Advanced**.
2. Automatically schedule 4-player doubles matches using a strict priority cascade:
   - **P1 (Pure):** 4 players from the same bracket.
   - **P2 (Adjacent Fill):** Majority bracket filled by immediate neighbor (B+I or I+A; never B+A).
   - **P3 (Split Fill):** Adjacent brackets split 2+2 or 3+1.
   - **P3B (Cross-Bracket Snake):** When no intermediates exist, allow B+A with snake drafting (`Team A: B1 + A2`, `Team B: B2 + A1`).
3. Enforce **Starvation Prevention** so small brackets (e.g. 2 Advanced players) are not bypassed indefinitely by larger pools.
4. Broadcast live court assignments to spectators via PAD-Q's standard `Live Court Status`.

### Non-Functional Constraints
- **Zero Cost / Free Tier ($0 / ₱0):** Must remain within Firebase Spark daily limits (50k reads, 20k writes). State updates per match completion must remain $O(1)$ write per court.
- **Atomic Concurrency:** Two courts finishing simultaneously must not assign the same player twice or corrupt queue order.
- **Spectator Transparency:** Spectators must see the court level tag (`Beginner Court`, `Intermediate Court`, or `Mixed Court`) without requiring a separate spectator protocol.
- **Fail-Safe Fallback:** If player skill tags are omitted, untagged players default to **Intermediate** without errors.

---

## 2. Options Considered

### Option A: Direct Port of Legacy Archive Architecture
* **How it works:** Re-activate `useState<SkilledState>` in `app/queue/page.tsx` as written on `all-features-archive`. Sync only `queue` to Firestore via `session.commitMatchResult({ queue }, entry)`.
* **Cost:** Very low implementation effort.
* **Failure Modes:** **Severe UX breakdown.** Spectators on the watch page see empty courts because `courtSlots` is never updated. If host reloads, active court assignments are lost.

### Option B: Unified Dual-Projection Architecture (Recommended)
* **How it works:** 
  1. The host maintains `skilledState` using the pure functions in `skilledMatchmakingEngine.ts`.
  2. Every court rotation maps `skilledState.courts` directly into PAD-Q's authoritative `courtSlots: CourtSlot[]`:
     ```typescript
     const courtSlots: CourtSlot[] = skilledState.courts.map(c => ({
       id: c.id,
       name: c.name,
       onCourt: c.players, // [TeamA_1, TeamA_2, TeamB_1, TeamB_2]
     }));
     ```
  3. Writes commit atomically using `batchMatchResult` or `commitMultiCourtResult`, syncing `queue`, `courtSlots`, and `history` in a single revision increment.
* **Cost:** Low to medium implementation effort.
* **Pros:** Spectators automatically see live skilled games via standard `LiveCourtStatus`; refresh recovery is 100% resilient; audit trail is preserved.
* **Failure Modes:** Requires ensuring Firestore rules accept `queueMode: 'skilled'` and that court validation passes.

### Option C: Server-Side Firestore Engine Execution
* **How it works:** Move `skilledMatchmakingEngine` into Firebase Cloud Functions triggered on match completion.
* **Cost:** Violates V1/V1.2 hard constraint (₱0 spend, no Cloud Functions on Firebase Spark).
* **Failure Modes:** Quota exhaustion, cold-start latency (1-3s delays when completing a game).

---

## 3. Options Comparison Matrix

| Criterion | Option A (Legacy Port) | Option B (Unified Projection) | Option C (Cloud Functions) |
| :--- | :---: | :---: | :---: |
| **Spectator Live Visibility** | ❌ None (courts blank) | ✅ Complete (Live Court Status) | ✅ Complete |
| **Host Refresh Resilience** | ❌ Lost on reload | ✅ Restored from `courtSlots` | ✅ Restored from server |
| **Infrastructure Cost** | ✅ $0 / Spark | ✅ $0 / Spark ($O(1)$ write) | ❌ Requires Blaze billing |
| **Code Reusability** | ✅ 90% archive code | ✅ 85% archive + modern glue | ❌ Full rewrite |
| **Rule Boundary Integrity** | ❌ Re-opens unversioned writes | ✅ Atomic monotonic revisions | ✅ Server authoritative |

> **Recommendation:** **Option B (Unified Dual-Projection)**. It delivers full feature fidelity while respecting the $0 free-tier boundary and providing seamless spectator visibility.

---

## 4. Architectural Decision Record (ADR)

```markdown
# ADR 0005: Unified Skill-Aware Matchmaking Projection for V1.2
Status: Proposed
Date: 2026-10-15
Branch: Matchmaking-skill-based

## Context
Skill-Aware Matchmaking provides automatic queue grouping and snake-draft court assignment. 
On the legacy `all-features-archive` branch, skilled state was local to the host's browser and 
did not populate `courtSlots`, preventing spectators from following matches on the watch page 
and causing state loss on refresh. In V1.0, multi-court management was standardized around 
`courtSlots` and atomic revisions.

## Decision
1. Unseal `skilled` queue mode in `releaseConfig.ts` and `firestore.rules`.
2. Adopt Option B (Unified Dual-Projection):
   - Host runs pure matchmaking decisions via `skilledMatchmakingEngine.ts`.
   - Every court assignment maps `skilledState.courts` into `SessionDoc.courtSlots`.
   - Result commits write atomically to Firestore with standard monotonic revisions.
3. Untagged players default to 'intermediate' in `buildSkillQueue`.
4. Spectator watch UI renders skill badges ('B', 'I', 'A') beside player names when `queueMode === 'skilled'`.

## Consequences
- Positive: Real-time court status works identically for default and skilled modes.
- Positive: Zero infrastructure cost (remains on Firebase Spark free tier).
- Positive: Full host refresh and crash recovery via existing `docToState` hydration.
- Negative: `firestore.rules` must support both 'default' and 'skilled' queue modes.

## Revisit When
When V2 introduces automated Elo/NGRP rating ingestion or permanent player profiles.
```

---

## 5. Verification & Implementation Roadmap

```mermaid
sequenceDiagram
    autonumber
    actor Host as Host Organizer
    participant UI as Queue Page
    participant Engine as Skilled Engine
    participant DB as Firestore (Session & History)
    actor Viewer as Spectators

    Host->>UI: Selects "Skilled" mode & tags players
    UI->>Engine: initSkilledState(players, brackets, courtDefs)
    Engine-->>UI: skilledState (courts + queue)
    UI->>DB: createSession(queueMode: 'skilled', courtSlots, queue)
    DB-->>Viewer: onSnapshot (Live Court Status with B/I/A badges)
    Host->>UI: Record Court 1 Win (Team A)
    UI->>Engine: rotatePlayersEngine() + reassignCourtEngine()
    Engine-->>UI: Updated courts & next assignment
    UI->>DB: commitMultiCourtResult(courtSlots, queue, historyEntry)
    DB-->>Viewer: onSnapshot (Instant court rotation broadcast)
```
