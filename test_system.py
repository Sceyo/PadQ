"""
test_system.py — PadQ algorithm correctness tests

Re-implements the core TypeScript engine logic in Python and
asserts the invariants that must hold for fair queue rotation.

Covers:
  - Doubles INIT phase: odd player count fix (Issue 2)
  - Doubles rotation: INIT → WINNERS → LOSERS cycle, pool assignments
  - Play-all + engine: both trackers run simultaneously without conflict (Issue 1)
  - Singles king-of-court: king persistence, loss, force rotation at streak 3
  - Multi-court heartbeat: all courts in the group are touched (Issue 3)
  - Queue integrity: every player appears exactly once in newQueue after each match

Run:
    python test_system.py
"""

import unittest
from dataclasses import dataclass, field
from typing import Optional


# ═══════════════════════════════════════════════════════════════
# Doubles engine — mirrors doublesEngine.ts
# ═══════════════════════════════════════════════════════════════

RECENT_PAIRS_CAP   = 6
RECENT_MATCHES_CAP = 4
MAX_POOL_SIZE      = 8


@dataclass
class PaddleState:
    phase:                str   = 'INIT'
    match_index_in_phase: int   = 0
    match_count:          int   = 0
    w1:                   list  = field(default_factory=list)
    l1:                   list  = field(default_factory=list)
    waiting_queue:        list  = field(default_factory=list)
    played_this_cycle:    set   = field(default_factory=set)
    recent_pairs:         list  = field(default_factory=list)
    recent_matches:       list  = field(default_factory=list)
    last_played_map:      dict  = field(default_factory=dict)


def _pair_key(a: str, b: str) -> str:
    return '+'.join(sorted([a, b]))


def _team_pair_key(team_a, team_b) -> str:
    ka = '+'.join(sorted(team_a))
    kb = '+'.join(sorted(team_b))
    return '|'.join(sorted([ka, kb]))


def _balance_pools(w1, l1):
    if len(w1) > MAX_POOL_SIZE:
        overflow = w1[:len(w1) - MAX_POOL_SIZE]
        w1 = w1[len(w1) - MAX_POOL_SIZE:]
        l1 = overflow + l1
    if len(l1) > MAX_POOL_SIZE:
        overflow = l1[:len(l1) - MAX_POOL_SIZE]
        l1 = l1[len(l1) - MAX_POOL_SIZE:]
        w1 = w1 + overflow
    return w1, l1


def build_next_match(state: PaddleState, all_players: list):
    """Returns (team_a, team_b) tuples. Simplified — no penalty scoring."""
    if state.phase == 'INIT':
        base = state.match_index_in_phase * 4
        pool = all_players[base:base + 4]
        if len(pool) < 4:
            # Safety fallback; should not be reached with floor-based init_matches_needed
            pool = (pool + [p for p in all_players if p not in pool])[:4]
        return (pool[0], pool[1]), (pool[2], pool[3])

    if state.phase == 'WINNERS':
        candidates = list(state.w1)
        if len(candidates) < 4:
            candidates += state.l1[:4 - len(candidates)]
    else:  # LOSERS
        candidates = list(state.l1)
        if len(candidates) < 4:
            candidates += state.w1[:4 - len(candidates)]

    if len(candidates) < 4:
        candidates = (candidates + all_players)[:4]
    return (candidates[0], candidates[1]), (candidates[2], candidates[3])


def advance_paddle_state(state: PaddleState, winner_team, loser_team, all_players):
    """
    Python mirror of advancePaddleState in doublesEngine.ts.
    Key fix vs original: uses floor(n/4) for INIT match count so odd
    remainder players go to waiting instead of being force-padded.
    Returns (next_state, new_queue).
    """
    all_four = list(winner_team) + list(loser_team)

    updated_recent_pairs = (state.recent_pairs + [
        _pair_key(winner_team[0], winner_team[1]),
        _pair_key(loser_team[0],  loser_team[1]),
    ])[-(RECENT_PAIRS_CAP * 2):]

    updated_recent_matches = (
        state.recent_matches + [_team_pair_key(winner_team, loser_team)]
    )[-RECENT_MATCHES_CAP:]

    updated_last_played = {**state.last_played_map, **{p: state.match_count for p in all_four}}
    new_played = set(state.played_this_cycle) | set(all_four)

    played_set  = set(all_four)
    next_w1     = [p for p in state.w1      if p not in played_set] + list(winner_team)
    next_l1     = [p for p in state.l1      if p not in played_set] + list(loser_team)
    next_waiting= [p for p in state.waiting_queue if p not in played_set]
    next_w1, next_l1 = _balance_pools(next_w1, next_l1)

    next_phase       = state.phase
    next_match_index = state.match_index_in_phase + 1
    next_played      = new_played

    if state.phase == 'INIT':
        # FIX (Issue 2): floor so odd remainders go to waiting, not padded into a match
        init_matches_needed = max(1, len(all_players) // 4)
        if next_match_index >= init_matches_needed:
            seeded_set  = set(all_players[:init_matches_needed * 4])
            overflow    = [p for p in all_players if p not in seeded_set and p not in next_waiting]
            next_waiting = next_waiting + overflow

            unplayed = [p for p in next_waiting if p not in next_played]
            next_w1  = unplayed + [p for p in next_w1 if p not in unplayed]
            next_waiting = [p for p in next_waiting if p in next_played]

            next_phase       = 'WINNERS'
            next_match_index = 0

    elif state.phase == 'WINNERS':
        next_phase       = 'LOSERS'
        next_match_index = 0

    else:  # LOSERS
        if all(p in next_played for p in all_players):
            next_played = set()

        unplayed = [p for p in next_waiting if p not in next_played]
        if unplayed:
            next_w1      = unplayed + [p for p in next_w1 if p not in unplayed]
            next_waiting = [p for p in next_waiting if p in next_played]

        next_phase       = 'WINNERS'
        next_match_index = 0

    next_state = PaddleState(
        phase=next_phase,
        match_index_in_phase=next_match_index,
        match_count=state.match_count + 1,
        w1=next_w1,
        l1=next_l1,
        waiting_queue=next_waiting,
        played_this_cycle=next_played,
        recent_pairs=updated_recent_pairs,
        recent_matches=updated_recent_matches,
        last_played_map=updated_last_played,
    )

    next_match = build_next_match(next_state, all_players)
    on_court   = set(next_match[0]) | set(next_match[1])
    off_court  = [p for p in all_players if p not in on_court]
    new_queue  = list(next_match[0]) + list(next_match[1]) + off_court
    return next_state, new_queue


# ═══════════════════════════════════════════════════════════════
# Singles engine — mirrors singleEngine.ts
# ═══════════════════════════════════════════════════════════════

SINGLES_MAX_WIN_STREAK = 3  # matches singleEngine.ts constant


@dataclass
class SinglesState:
    queue:             list          = field(default_factory=list)
    king:              Optional[str] = None
    match_index:       int           = 0
    last_played_map:   dict          = field(default_factory=dict)
    win_streak:        dict          = field(default_factory=dict)
    played_this_cycle: set           = field(default_factory=set)
    waiting_queue:     list          = field(default_factory=list)


def _select_challenger(queue: list, last_played_map: dict, match_index: int):
    """Returns (challenger, remaining_queue). Skips the player from the last match."""
    last_match_idx = match_index - 1
    for i, p in enumerate(queue):
        if last_played_map.get(p, -1) != last_match_idx:
            return p, queue[:i] + queue[i + 1:]
    return queue[0], queue[1:] if len(queue) > 1 else []


def advance_singles_state(state: SinglesState, winner: str, all_players: list):
    """
    Python mirror of advanceSinglesState in singleEngine.ts.
    Returns (next_state, new_queue).
    """
    next_queue = list(state.queue) + list(state.waiting_queue)

    was_init   = state.king is None
    was_forced = (not was_init) and (state.win_streak.get(state.king, 0) >= SINGLES_MAX_WIN_STREAK)

    if was_init or was_forced:
        player_a, player_b = next_queue[0], next_queue[1]
        remaining_queue    = next_queue[2:]
    else:
        player_a = state.king
        player_b, remaining_queue = _select_challenger(next_queue, state.last_played_map, state.match_index)

    loser = player_b if winner == player_a else player_a

    next_last_played = {**state.last_played_map, player_a: state.match_index, player_b: state.match_index}
    new_played       = set(state.played_this_cycle) | {player_a, player_b}
    next_played      = set() if all(p in new_played for p in all_players) else new_played
    next_streak      = dict(state.win_streak)

    if was_init:
        next_queue = remaining_queue + [loser]
        next_king  = winner
        next_streak[winner] = 1
    elif was_forced:
        old_king   = state.king
        next_queue = remaining_queue + [loser, old_king]
        next_king  = winner
        next_streak[old_king] = 0
        next_streak[winner]   = 1
    else:
        if winner == state.king:
            next_king  = state.king
            next_streak[next_king] = next_streak.get(next_king, 0) + 1
            next_queue = remaining_queue + [loser]
        else:
            old_king   = state.king
            next_king  = winner
            next_streak[old_king]  = 0
            next_streak[next_king] = 1
            next_queue = remaining_queue + [old_king]

    next_state = SinglesState(
        queue=next_queue,
        king=next_king,
        match_index=state.match_index + 1,
        last_played_map=next_last_played,
        win_streak=next_streak,
        played_this_cycle=next_played,
        waiting_queue=[],
    )
    new_queue = [next_king] + next_queue
    return next_state, new_queue


# ═══════════════════════════════════════════════════════════════
# § 1  Doubles INIT phase — Issue 2 fix
# ═══════════════════════════════════════════════════════════════

class TestDoublesInitPhase(unittest.TestCase):
    """
    Odd player counts must not cause any player to appear twice in INIT.
    Fix: advance_paddle_state uses floor(n/4) instead of ceil(n/4) for
    INIT match count; remainder players go to waitingQueue.
    """

    def _init_play_counts(self, players):
        """Return {player: number_of_INIT_matches_played} for the INIT phase only."""
        state  = PaddleState()
        counts = {p: 0 for p in players}
        init_needed = max(1, len(players) // 4)
        for _ in range(init_needed):
            if state.phase != 'INIT':
                break
            match = build_next_match(state, players)
            for p in list(match[0]) + list(match[1]):
                counts[p] += 1
            state, _ = advance_paddle_state(state, match[0], match[1], players)
        return counts, state

    def test_5_players_no_double_play_in_init(self):
        counts, _ = self._init_play_counts(['A', 'B', 'C', 'D', 'E'])
        for p, c in counts.items():
            self.assertLessEqual(c, 1, f"{p} played {c} times in INIT with 5 players")

    def test_6_players_no_double_play_in_init(self):
        counts, _ = self._init_play_counts(['A', 'B', 'C', 'D', 'E', 'F'])
        for p, c in counts.items():
            self.assertLessEqual(c, 1, f"{p} played {c} times in INIT with 6 players")

    def test_7_players_no_double_play_in_init(self):
        counts, _ = self._init_play_counts(list('ABCDEFG'))
        for p, c in counts.items():
            self.assertLessEqual(c, 1, f"{p} played {c} times in INIT with 7 players")

    def test_8_players_all_play_exactly_once_in_init(self):
        counts, _ = self._init_play_counts(list('ABCDEFGH'))
        for p, c in counts.items():
            self.assertEqual(c, 1, f"{p} played {c} times — should be exactly 1 in INIT with 8 players")

    def test_6_players_remainder_enters_engine_after_init(self):
        """After INIT with 6 players, E and F must be in the engine pools, not lost."""
        players = ['A', 'B', 'C', 'D', 'E', 'F']
        state   = PaddleState()
        state, _ = advance_paddle_state(state, ('A', 'B'), ('C', 'D'), players)

        self.assertEqual(state.phase, 'WINNERS',
            "Phase should have transitioned to WINNERS after 1 INIT match with 6 players")
        all_tracked = set(state.w1) | set(state.l1) | set(state.waiting_queue)
        self.assertIn('E', all_tracked, "E must appear in engine pools after INIT")
        self.assertIn('F', all_tracked, "F must appear in engine pools after INIT")


# ═══════════════════════════════════════════════════════════════
# § 2  Doubles rotation cycle — INIT → WINNERS → LOSERS
# ═══════════════════════════════════════════════════════════════

class TestDoublesRotation(unittest.TestCase):

    def _run_matches(self, players, n):
        """Run n matches (team A always wins). Return (play_counts, final_state)."""
        state  = PaddleState()
        counts = {p: 0 for p in players}
        for _ in range(n):
            match = build_next_match(state, players)
            for p in list(match[0]) + list(match[1]):
                counts[p] += 1
            state, _ = advance_paddle_state(state, match[0], match[1], players)
        return counts, state

    def test_phase_sequence_init_winners_losers(self):
        players     = list('ABCDEFGH')
        state       = PaddleState()
        phases_seen = []
        for _ in range(6):
            phases_seen.append(state.phase)
            match = build_next_match(state, players)
            state, _ = advance_paddle_state(state, match[0], match[1], players)
        self.assertIn('INIT',    phases_seen)
        self.assertIn('WINNERS', phases_seen)
        self.assertIn('LOSERS',  phases_seen)

    def test_8_players_all_play_within_4_matches(self):
        counts, _ = self._run_matches(list('ABCDEFGH'), 4)
        for p, c in counts.items():
            self.assertGreaterEqual(c, 1, f"{p} never played in 4 matches with 8 players")

    def test_winners_end_up_in_w1(self):
        players = list('ABCDEFGH')
        state   = PaddleState()
        # Complete INIT (2 matches)
        for _ in range(2):
            match  = build_next_match(state, players)
            state, _ = advance_paddle_state(state, match[0], match[1], players)
        self.assertEqual(state.phase, 'WINNERS')
        # Play one WINNERS match and verify winner lands in w1
        match = build_next_match(state, players)
        winner_team = match[0]
        state, _ = advance_paddle_state(state, winner_team, match[1], players)
        for p in winner_team:
            self.assertIn(p, state.w1, f"Winner {p} must be in w1 after WINNERS match")

    def test_losers_end_up_in_l1(self):
        players = list('ABCDEFGH')
        state   = PaddleState()
        for _ in range(2):
            match  = build_next_match(state, players)
            state, _ = advance_paddle_state(state, match[0], match[1], players)
        match       = build_next_match(state, players)
        loser_team  = match[1]
        state, _ = advance_paddle_state(state, match[0], loser_team, players)
        for p in loser_team:
            self.assertIn(p, state.l1, f"Loser {p} must be in l1 after WINNERS match")

    def test_match_count_increments_each_match(self):
        players = list('ABCDEF')
        state   = PaddleState()
        for i in range(1, 7):
            match  = build_next_match(state, players)
            state, _ = advance_paddle_state(state, match[0], match[1], players)
            self.assertEqual(state.match_count, i)


# ═══════════════════════════════════════════════════════════════
# § 3  Play-all + paddle engine — Issue 1 fix
# ═══════════════════════════════════════════════════════════════

class TestPlayAllWithEngine(unittest.TestCase):
    """
    Issue 1 fix: in play-all mode, advancePaddleState runs in addition to
    recordPlayAllDoubles. Both must execute each match without conflict.
    """

    def _pair_key(self, p, q):
        return '+'.join(sorted([p, q]))

    def test_both_trackers_advance_each_match(self):
        players      = list('ABCDEFGH')
        state        = PaddleState()
        play_all_rel = {}

        for _ in range(8):
            match      = build_next_match(state, players)
            team_a, team_b = match

            # play-all tracker (recordPlayAllDoubles equivalent)
            for p in team_a:
                for q in team_b:
                    key = self._pair_key(p, q)
                    play_all_rel[key] = play_all_rel.get(key, 0) + 1

            # paddle engine still runs (Issue 1 fix)
            state, _ = advance_paddle_state(state, team_a, team_b, players)

        self.assertGreater(state.match_count, 0,
            "Paddle engine match_count must have advanced")
        self.assertGreater(len(play_all_rel), 0,
            "play_all_rel must have recorded opponent pairings")

    def test_play_all_records_every_on_court_pairing(self):
        """Each match should add exactly 4 opponent pair keys (2×2 cross-team)."""
        players      = list('ABCDEFGH')
        state        = PaddleState()
        play_all_rel = {}

        for _ in range(4):
            match = build_next_match(state, players)
            team_a, team_b = match
            pairs_before = len(play_all_rel)
            for p in team_a:
                for q in team_b:
                    key = self._pair_key(p, q)
                    play_all_rel[key] = play_all_rel.get(key, 0) + 1
            state, _ = advance_paddle_state(state, team_a, team_b, players)
            # Each new match introduces at most 4 cross-team pairings
            new_keys = len(play_all_rel) - pairs_before
            self.assertLessEqual(new_keys, 4,
                "At most 4 new opponent pair keys per match")

    def test_engine_phase_advances_in_play_all_mode(self):
        """Paddle engine must cycle through phases even when play-all tracker is active."""
        players = list('ABCDEFGH')
        state   = PaddleState()
        phases  = set()
        for _ in range(6):
            phases.add(state.phase)
            match = build_next_match(state, players)
            state, _ = advance_paddle_state(state, match[0], match[1], players)
        self.assertIn('INIT',    phases)
        self.assertIn('WINNERS', phases)
        self.assertIn('LOSERS',  phases)


# ═══════════════════════════════════════════════════════════════
# § 4  Singles king-of-court
# ═══════════════════════════════════════════════════════════════

class TestSinglesKingOfCourt(unittest.TestCase):

    def _fresh(self, players):
        return SinglesState(queue=list(players))

    def test_first_winner_becomes_king(self):
        players = list('ABCDE')
        state, _ = advance_singles_state(self._fresh(players), 'A', players)
        self.assertEqual(state.king, 'A')

    def test_king_stays_on_win(self):
        players = list('ABCDE')
        state, _ = advance_singles_state(self._fresh(players), 'A', players)
        state, _ = advance_singles_state(state, 'A', players)
        self.assertEqual(state.king, 'A')

    def test_king_deposed_on_loss(self):
        players = list('ABCDE')
        state, _ = advance_singles_state(self._fresh(players), 'A', players)  # A = king
        state, _ = advance_singles_state(state, 'B', players)                 # B beats A
        self.assertEqual(state.king, 'B', "Challenger who wins must become new king")
        self.assertEqual(state.win_streak.get('A', 0), 0, "Deposed king streak must reset")

    def test_streak_increments_on_each_win(self):
        players = list('ABCDE')
        state, _ = advance_singles_state(self._fresh(players), 'A', players)
        self.assertEqual(state.win_streak.get('A', 0), 1)
        state, _ = advance_singles_state(state, 'A', players)
        self.assertEqual(state.win_streak.get('A', 0), 2)
        state, _ = advance_singles_state(state, 'A', players)
        self.assertEqual(state.win_streak.get('A', 0), 3)

    def test_force_rotation_fires_at_max_streak(self):
        """After 3 wins A is at max streak; the next match must force-rotate A off throne."""
        players = list('ABCDE')
        state, _ = advance_singles_state(self._fresh(players), 'A', players)
        state, _ = advance_singles_state(state, 'A', players)
        state, _ = advance_singles_state(state, 'A', players)
        self.assertEqual(state.win_streak.get('A', 0), SINGLES_MAX_WIN_STREAK)
        # Force rotation: winner of the forced match becomes new king; A's streak resets
        state, _ = advance_singles_state(state, 'B', players)
        self.assertEqual(state.win_streak.get('A', 0), 0,
            "A's streak must reset to 0 after being force-rotated off throne")

    def test_loser_stays_in_queue(self):
        players = list('ABCDE')
        state, q = advance_singles_state(self._fresh(players), 'A', players)
        self.assertIn('B', q, "Loser B must remain in queue")
        self.assertNotEqual(q[0], 'B', "Loser must not occupy king slot (queue[0])")

    def test_challenger_streak_resets_zero_when_not_winning(self):
        players = list('ABCDE')
        state, _ = advance_singles_state(self._fresh(players), 'A', players)  # A=king, streak=1
        state, _ = advance_singles_state(state, 'A', players)                 # A=king, streak=2
        # B loses as challenger — B's streak should be 0 (never set or remains 0)
        self.assertEqual(state.win_streak.get('B', 0), 0)


# ═══════════════════════════════════════════════════════════════
# § 5  Multi-court heartbeat coverage — Issue 3 fix
# ═══════════════════════════════════════════════════════════════

class TestHeartbeatCoverage(unittest.TestCase):
    """
    Issue 3 fix: the heartbeat must touch ALL courts in the group, not
    just the currently loaded one. This verifies the logic pattern
    implemented in useSession.ts.
    """

    def _simulate_heartbeat(self, court_group, active_session_id):
        """Replicate the fixed setInterval callback from useSession.ts."""
        touched = []
        touched.append(active_session_id)                    # always touch active
        for c in court_group:
            if c['sessionId'] != active_session_id:          # touch idle courts
                touched.append(c['sessionId'])
        return touched

    def test_all_3_courts_touched(self):
        courts = [
            {'sessionId': 'AAAA', 'hostToken': 'tok-a'},
            {'sessionId': 'BBBB', 'hostToken': 'tok-b'},
            {'sessionId': 'CCCC', 'hostToken': 'tok-c'},
        ]
        touched = self._simulate_heartbeat(courts, 'AAAA')
        self.assertIn('AAAA', touched, "Active court must be touched")
        self.assertIn('BBBB', touched, "Idle court BBBB must be touched")
        self.assertIn('CCCC', touched, "Idle court CCCC must be touched")
        self.assertEqual(len(touched), 3, "All 3 courts touched exactly once")

    def test_5_courts_all_touched(self):
        courts = [{'sessionId': f'C{i:03}', 'hostToken': f'tok-{i}'} for i in range(5)]
        touched = self._simulate_heartbeat(courts, 'C000')
        self.assertEqual(len(touched), 5, "All 5 courts must be touched")
        for c in courts:
            self.assertIn(c['sessionId'], touched)

    def test_single_court_touched_exactly_once(self):
        courts  = [{'sessionId': 'ZZZZ', 'hostToken': 'tok-z'}]
        touched = self._simulate_heartbeat(courts, 'ZZZZ')
        self.assertEqual(touched, ['ZZZZ'], "Single court touched exactly once")

    def test_active_court_not_double_touched(self):
        courts = [
            {'sessionId': 'MAIN', 'hostToken': 'tok-m'},
            {'sessionId': 'SIDE', 'hostToken': 'tok-s'},
        ]
        touched = self._simulate_heartbeat(courts, 'MAIN')
        self.assertEqual(touched.count('MAIN'), 1, "Active court must not be touched twice")


# ═══════════════════════════════════════════════════════════════
# § 6  Queue integrity — every player appears exactly once
# ═══════════════════════════════════════════════════════════════

class TestQueueIntegrity(unittest.TestCase):
    """
    The newQueue returned after every match must contain every player
    in allPlayers exactly once. No duplicates, no missing players.
    """

    def test_doubles_8_players_queue_complete_over_10_matches(self):
        players = list('ABCDEFGH')
        state   = PaddleState()
        for i in range(10):
            match  = build_next_match(state, players)
            state, new_queue = advance_paddle_state(state, match[0], match[1], players)
            self.assertEqual(sorted(new_queue), sorted(players),
                f"Queue mismatch at match {i + 1}: got {new_queue}")

    def test_doubles_6_players_queue_complete_over_12_matches(self):
        """Odd player count — previously broken due to INIT padding bug."""
        players = list('ABCDEF')
        state   = PaddleState()
        for i in range(12):
            match  = build_next_match(state, players)
            state, new_queue = advance_paddle_state(state, match[0], match[1], players)
            self.assertEqual(sorted(new_queue), sorted(players),
                f"Queue mismatch at match {i + 1} with 6 players: got {new_queue}")

    def test_doubles_5_players_queue_complete_over_10_matches(self):
        players = list('ABCDE')
        state   = PaddleState()
        for i in range(10):
            match  = build_next_match(state, players)
            state, new_queue = advance_paddle_state(state, match[0], match[1], players)
            self.assertEqual(sorted(new_queue), sorted(players),
                f"Queue mismatch at match {i + 1} with 5 players: got {new_queue}")

    def test_singles_5_players_queue_complete_over_10_matches(self):
        players = list('ABCDE')
        state   = SinglesState(queue=list(players))
        for i in range(10):
            # When king has maxed streak, force rotation plays queue[0] vs queue[1] —
            # king is sitting out, so winner must be one of those two players, not king.
            king_maxed = state.king is not None and state.win_streak.get(state.king, 0) >= SINGLES_MAX_WIN_STREAK
            if state.king is None or king_maxed:
                winner = state.queue[0]
            else:
                winner = state.king
            state, new_queue = advance_singles_state(state, winner, players)
            self.assertEqual(sorted(new_queue), sorted(players),
                f"Singles queue mismatch at match {i + 1}: got {new_queue}")

    def test_doubles_no_duplicates_in_queue(self):
        players = list('ABCDEFGH')
        state   = PaddleState()
        for _ in range(8):
            match  = build_next_match(state, players)
            state, new_queue = advance_paddle_state(state, match[0], match[1], players)
            self.assertEqual(len(new_queue), len(set(new_queue)),
                f"Duplicate players in queue: {new_queue}")


SUITES = {
    'init':      TestDoublesInitPhase,
    'rotation':  TestDoublesRotation,
    'playall':   TestPlayAllWithEngine,
    'singles':   TestSinglesKingOfCourt,
    'heartbeat': TestHeartbeatCoverage,
    'integrity': TestQueueIntegrity,
}

if __name__ == '__main__':
    import sys

    arg = sys.argv[1] if len(sys.argv) > 1 else None

    if arg and arg not in SUITES:
        print(f"Unknown suite '{arg}'.")
        print(f"Available: {', '.join(SUITES)}\n")
        sys.exit(1)

    if arg:
        suite  = unittest.TestLoader().loadTestsFromTestCase(SUITES[arg])
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        sys.exit(0 if result.wasSuccessful() else 1)

    print(f"Available suites: {', '.join(SUITES)}")
    print("Usage: python test_system.py [suite]  — omit to run all\n")
    unittest.main(verbosity=2, argv=[sys.argv[0]])
