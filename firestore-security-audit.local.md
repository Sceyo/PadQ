# PAD-Q V1 Firestore security inventory (local working note)

This file is intentionally untracked. It records the Phase 1 findings used to
harden `firestore.rules` and the client service layer.

## Runtime and authentication

- Next.js 16 / React 19 / TypeScript client application.
- Firebase Web SDK with anonymous authentication before every Firestore call.
- All Firestore access is centralized in `lib/sessionService.ts`.
- Hosts are authorized by immutable `sessions/{sessionId}.hostUid`.
- Spectators are anonymous-authenticated and read-only.

## Collections and paths

### `sessions/{sessionId}`

- Document ID: six characters from the unambiguous alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`.
- Required fields: `hostUid`, `revision`, `gameMode`, `queueMode`, `elimType`,
  `players`, `queue`, `playAllRel`, `tournamentMatches`, `tournamentActive`,
  `tournamentWinner`, `createdAt`, `updatedAt`, `lastActiveAt`.
- Optional V1 fields: `liveScore`, `isLive`, `accessPin`, `courtName`,
  `doublesEngineState`, `singlesEngineState`, `courtSlots`, `lockedPartners`,
  `sittingOut`.
- V1 invariants: Default queue only, 30 players maximum, three courts maximum,
  no player assigned to two courts, PIN disabled, tournament state
  empty/inactive, Play-All relationships empty.

Operations:

- Individual `get`: host recovery, spectator room-code lookup, PIN compatibility check.
- Individual real-time listener: host and spectator session updates.
- Create: host only; ownership bound to authenticated UID.
- Update/transaction: original host only; ownership and creation time immutable.
- Delete: original host only.
- Collection list/query: not used and must be denied.

### `sessions/{sessionId}/history/{commandId}`

- Required fields: `id`, `mode`, `players`, `winner`, `timestamp`, `commandId`, `revision`.
- Optional field: `score`.
- `commandId` is a UUID and must equal the document ID.

Operations:

- Known-parent query ordered by `id desc`, limited to 1 for undo.
- Known-parent real-time query ordered by `id desc`, limited to 100 for viewers/hosts.
- Atomic create with a parent revision increment.
- Host-only delete; updates denied.
- Reads require authentication and an existing parent session.

## Threat findings to test

1. Session collection listing was allowed by the old blanket `read` rule.
2. Hidden queue modes and up to six courts were still accepted by backend rules.
3. Four-character `Math.random()` codes were enumerable and creation was not atomic.
4. Session list fields had count limits but insufficient element validation.
5. Engine maps and live scores need bounded schemas.
6. Unknown fields, ownership changes, timestamp manipulation, invalid revisions,
   orphan history access and oversized payloads must remain denied.

## Firestore rules evaluation constraint

Firestore caps a request at 1,000 evaluated rule expressions. Deep validation
of every value across a 30-player roster, queue, three court lists and many locked
partner pairs exceeds that limit and rejects valid rooms. The rules therefore
enforce strict document keys, list counts, mode/court limits and a partner-pair
count no greater than half the roster; the host client and queue engine enforce
pair shape, player-name bounds, roster membership and uniqueness.
Room creation performs the deepest engine validation. Host-only updates validate
the complete outer engine schema, enums, scalar ranges and collection bounds but
do not rescan every nested engine value, leaving expression budget for atomic
three-court result and history writes.
App Check remains required to reduce hostile-client abuse, and Firestore's
document-size ceiling provides the final payload bound.

## Query compatibility requirements

- Session document `get` and `onSnapshot` must succeed for authenticated users.
- No `sessions` collection query is required.
- History list queries must remain allowed only beneath an existing known session.
- The `id desc` history queries use single-field indexing and require no composite index.

## Devil's advocate results

| Attack | Result |
|---|---|
| Public/anonymous session list | Denied; authenticated collection list also denied |
| Unknown-room or unauthenticated read | Unauthenticated read denied; known-room authenticated get intentionally allowed |
| Unauthorized session update/delete | Denied by immutable `hostUid` ownership |
| Viewer changes a court assignment | Denied; only the immutable room owner may update the session |
| Same player assigned to two courts | Denied by pairwise court-roster validation |
| Update bypass / unknown field | Denied by the shared `validSession` validator on create and update |
| Ownership hijack on create | Denied; `hostUid` must equal `request.auth.uid` |
| Ownership hijack on update | Denied; `hostUid` is immutable |
| Created timestamp modification | Denied; immutable and server-stamped |
| Type/schema corruption | Structured maps, enums, timestamps and list/map bounds validated; player-list element depth remains a documented platform-limit exception |
| Oversized list/resource use | Denied above 30 players/queue/sit-outs, 3 courts, 15 pairs and bounded engine fields; Firestore's document limit remains the byte ceiling |
| Missing required fields | Denied by `hasAll` and the shared validator |
| Privilege escalation | No role fields exist; unknown fields denied |
| Deferred-mode transition | Denied; only Default/single-elimination placeholder state is valid |
| Path traversal | No user-controlled storage/document path fields exist |
| Negative/overflow scores and counters | Live score and revision ranges are bounded |
| Mixed private/public profile data | N/A; no user profile collection exists |
| History replay/standalone write | Denied unless atomically matched to the parent revision; command document is immutable |
| Orphaned history access | Denied when the parent session does not exist |
| Query mismatch | Known-room session get and bounded known-parent history queries pass |
| Validator pattern | Both session create and update call `validSession`; history is immutable |

Emulator outcome: 16/16 adversarial rules tests passed, including separate
30-player roster, three populated court, combined real-life room, missing-field,
duplicate-court-player, ownership and atomic-history cases. Firebase dry-run
compilation passed for the preceding candidate. The exact final rules compile
in the local emulator; repeat the remote compile-only dry run before deployment.

Application outcome: automated multi-court simulations pass with 30 players,
three courts, all 15 possible partner pairs, and 150 staggered rotations. The
live editor restricts new pairs to players currently sharing one court or the
waiting queue, preventing cross-court pairing from interrupting active matches.
