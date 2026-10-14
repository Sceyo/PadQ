# V1.2 Skill-Aware Matchmaking Specification

**Status:** In Development  
**Branch:** `Matchmaking-skill-based`  
**Target Release:** PAD-Q V1.2  

---

## 1. Feature Overview

Skill-Aware Matchmaking organizes doubles players into three balanced skill brackets:
- **Beginner (B):** Green (`#22c55e`), introductory and casual players.
- **Intermediate (I):** Amber (`#f59e0b`), standard club/recreational level.
- **Advanced (A):** Red (`#ef4444`), competitive tournament/experienced players.

The system automatically assigns matches to courts using a deterministic priority cascade, prevents bracket starvation, manages rest intervals when player headcount exceeds court capacity, and balances teams using snake-draft placement.

---

## 2. Algorithmic Matchmaking Hierarchy

When selecting four players for an available court, `pickBestGroup` evaluates waiting players in the following order:

```
[Available Court Needs 4 Players]
       │
       ▼
[P0: Starvation Override] ──> Has any bracket waited ≥ Starvation Threshold?
       │ No                     └──> Yes: Force include starved player with snake draft
       ▼
[P1: Pure Match] ───────────> Are ≥ 4 players waiting in Beginner, Intermediate, or Advanced?
       │ No                     └──> Yes: Schedule Pure Bracket Match
       ▼
[P2: Majority + Adjacent] ──> Can majority bracket be filled by immediate neighbor (B+I or I+A)?
       │ No                     └──> Yes: Schedule Adjacent Match (Never B+A)
       ▼
[P3: Split Fill] ───────────> Can adjacent brackets combine 2+2 or 3+1 (B+I or I+A)?
       │ No                     └──> Yes: Schedule Split Match
       ▼
[P3B: Cross-Bracket Snake] ─> Cross-bracket fallback (B+A) when no Intermediates exist
                                └──> Yes: Snake-draft teams so strong pairs with weak
```

### Priority Definitions

1. **P0 — Starvation Override:**
   - Threshold: $\max(2, \text{courtCount})$ cycles.
   - If a bracket has been bypassed despite having waiting players, a starved player is force-picked and combined with 3 other waiting players via snake draft.
2. **P1 — Pure Match:**
   - Evaluated in order: Beginner $\to$ Intermediate $\to$ Advanced.
   - Returns 4 players of the exact same skill level. Court is tagged with pure level badge.
3. **P2 — Majority + 1 Adjacent Fill:**
   - Finds the bracket with the most players.
   - Fills the shortfall strictly from adjacent levels ($B \leftarrow I$, $I \leftarrow B \text{ or } A$, $A \leftarrow I$).
   - Cross-bracket filling ($B \leftarrow A$) is strictly blocked in P2.
4. **P3 — Split Fill:**
   - Allows combinations across adjacent pairs summing to 4 (e.g. 2 B + 2 I, 3 B + 1 I, 2 I + 2 A, 1 I + 3 A).
5. **P3B — Cross-Bracket Snake Draft:**
   - Fallback when no Intermediate players are available and both Beginner and Advanced players are waiting.
   - Applies snake drafting to ensure competitive balance.

---

## 3. Snake-Draft Team Balancing

To prevent lopsided matches in mixed or cross-bracket games, four selected players are sorted descending by skill ($3 \to 1$):
- `sorted[0]` = Player 1 (Highest skill)
- `sorted[1]` = Player 2 (Second highest)
- `sorted[2]` = Player 3 (Third highest)
- `sorted[3]` = Player 4 (Lowest skill)

The engine interleaves them into teams:
$$\text{Team A} = [\text{sorted}[0], \text{sorted}[3]] \quad (\text{Highest} + \text{Lowest})$$
$$\text{Team B} = [\text{sorted}[1], \text{sorted}[2]] \quad (\text{Middle two})$$

Stored in `CourtSlot.onCourt` as `[TeamA_1, TeamA_2, TeamB_1, TeamB_2]`.

---

## 4. Multi-Court State Synchronization (V1.2 Architecture)

In V1.2, `skilledState.courts` maps directly to authoritative `courtSlots`:

```typescript
export interface CourtSlot {
  id: string;
  name: string;
  onCourt: string[]; // [A1, A2, B1, B2]
}
```

### Synchronized Data Flow
1. **Host Action:** Result recorded for Court $N$.
2. **Engine Rotation:** `rotatePlayersEngine` moves played players to rest or back of queue; `reassignCourtEngine` pulls the next group; `fillIdleCourtsEngine` handles emergency pulls if queue is short.
3. **Dual Projection:** `courtSlots` is populated with all active court rosters; `queue` is populated with `skilledState.waitingQueue`.
4. **Atomic Commit:** `commitMultiCourtResult` writes both `courtSlots` and `queue` to Firestore in a single transaction with revision increment.
5. **Real-Time Spectator View:** Viewers on `app/watch/[sessionId]` receive updated `courtSlots` instantly and render skill badges beside player names.

---

## 5. Persistence & Schema Boundaries

- **Local Storage:**
  - `padq_skilled_brackets`: Keyed JSON storing `{ beginner: string[], intermediate: string[], advanced: string[] }`.
  - Persists across host page reloads.
- **Firestore Schema:**
  - `SessionDoc.queueMode`: Expanded to `'default' | 'skilled'`.
  - Enforced in `firestore.rules`:
    ```rules
    data.queueMode in ['default', 'skilled']
    ```
- **Untagged Players:**
  - Any player not explicitly tagged in Beginner or Advanced defaults automatically to **Intermediate**.
