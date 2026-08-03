# PADQ Release Roadmap

This roadmap describes intended release scope. It does not authorize a feature
for production by itself: every release still requires reviewed security rules,
realistic browser tests, free-tier measurements, and a controlled rollout.

Release numbers describe product scope, not promised dates. A version advances
only after the previous version is stable in real events.

## Release overview

| Version | Theme | Primary outcome |
| --- | --- | --- |
| V1.0 | Reliable club-night launch | One host runs a 30-player, 3-court event while players follow live court status. |
| V1.1 | Collaborative management | One owner and up to two co-hosts safely manage the same room. |
| V1.2 | Optional court scoring | Scoped court controllers can record scores without receiving full-room control. |
| V1.3 | Event formats | Selected tournament, Play-All, and skill-aware formats return after separate hardening. |
| V1.4 | Accounts and portability | Hosts can recover ownership across devices and retain organization data safely. |
| V2.0 | Club operations | PADQ can support commercial clubs, stronger administration, integrations, and paid-scale operations. |

## V1.0 — Reliable club-night launch

**Goal:** launch the smallest dependable PADQ experience on Firebase Spark and
Vercel Hobby.

- One authenticated host controls the room from one browser identity.
- Up to 30 players and 3 shared courts.
- Default singles and doubles rotations.
- Optional fixed partner pairs, capped at `floor(players / 2)`.
- Host records completed winners for each court.
- Viewers choose Court 1–3 and see current players, the waiting queue, upcoming
  assignments, completed history, and performance.
- No point-by-point multi-court scoring and no delegated controllers.

The blocking launch checklist remains in
[`V1-RELEASE-GATES.md`](V1-RELEASE-GATES.md).

## V1.1 — Collaborative session management

**Priority feature:** one session owner plus up to two co-hosts, for a maximum of
three controllers managing the same room.

Initial V1.1 scope:

- Owner creates one-time co-host invitations or QR links.
- Accepting an invitation binds the co-host's authenticated Firebase UID to the
  session; host credentials are never shared.
- Co-hosts can manage players, queue order, court assignments, partner pairs,
  sit-outs, substitutions, and completed winners across all three courts.
- Only the owner can invite or revoke co-hosts, delete the room, or transfer
  ownership.
- Winner submission and queue rotation remain transactional and duplicate-safe.
- Actions record the controller identity needed for troubleshooting and audit.
- Point-by-point scoring remains out of scope.

V1.1 release gates:

- Firestore schema and rules cap controllers at one owner plus two co-hosts.
- Invitation redemption is one-time, revocable, and cannot grant owner powers.
- Tests cover simultaneous results, queue edits, partner edits, revocation,
  refresh, lost anonymous identity, and malicious invitation reuse.
- Three controllers plus 30 viewers remain within the approved Spark read/write
  budget.
- V1.0 completes at least one controlled live event without a blocking incident
  before collaborative management is enabled.

## V1.2 — Optional court scoring

Candidate scope after V1.1 is stable:

- Owner may assign a controller to a specific court.
- A court controller may update that court's point score and submit its result,
  but cannot manage another court or the full room.
- Viewers see a live score only for the court they selected.
- Winner-only operation remains the default.

Point-by-point scoring is released only if a 30-viewer capacity test demonstrates
safe Spark headroom. Otherwise it requires a deliberate backend or billing-plan
decision.

## V1.3 — Event formats

Candidate features are released individually after they pass the same integrity
and capacity standards as the default queue:

- Tournament and double-elimination events.
- Play-All rotations with relationship tracking.
- Skill-aware matchmaking and visible skill brackets.
- Configurable singles streak limits.
- Event-level CSV roster import and result export.

V1.3 does not enable every archived feature at once. Each format must prove that
it cannot corrupt the default queue, exceed the player/court limits, or expose
fields rejected by the production Firestore schema.

## V1.4 — Accounts and portability

- Optional permanent host accounts.
- Safe cross-device owner recovery.
- Persistent club rosters and organization preferences.
- Event archive and controlled history retention.
- Stronger spectator privacy through a separate public data projection.
- Verified session expiry and recovery policies.

Anonymous, no-account viewing remains available unless privacy requirements for
a particular event explicitly require authentication.

## V2.0 — Club operations and commercial scale

- Multi-organization administration and staff roles.
- Club-level dashboards and richer operational analytics.
- Booking, payment, membership, or third-party integrations only where they
  reinforce PADQ's live-event workflow.
- Monitoring, backups, incident recovery, support processes, and service-level
  expectations appropriate for paying organizations.
- Reassessed Firebase and Vercel plans based on measured commercial usage.
- Privacy, retention, export, and account-deletion controls suitable for a
  production service with persistent users.

V2.0 should not turn PADQ into an unfocused booking suite. Its core remains live
court rotation, transparent next-player assignment, and practical event control.

## Unscheduled candidates

These remain ideas rather than committed version scope:

- Viewer access PINs for private events.
- Public cross-room rankings or leaderboards.
- Media uploads, highlight clips, or player profile images.
- Notifications and event reminders.
- Native mobile applications.
- Hardware scoreboard or access-control integrations.

Any commercial launch must revisit Vercel Hobby eligibility, Firebase quotas,
support expectations, monitoring, privacy, and recovery requirements.
