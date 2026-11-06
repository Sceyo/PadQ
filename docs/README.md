# Documentation Index

This directory contains the operational, architectural, testing, and release documentation for PAD-Q.

---

## 1. Release & Verification
- [V1-RELEASE-GATES.md](V1-RELEASE-GATES.md) — Definitive release gates, requirements, and sign-offs for production launch.
- [V1-PUBLIC-RELEASE-TASKS.md](V1-PUBLIC-RELEASE-TASKS.md) — Public release checklist, recent audit entries, and verification status.
- [GATE4-RELEASE-CANDIDATE.md](GATE4-RELEASE-CANDIDATE.md) — Release candidate qualification audit and verification logs.
- [V1-SCOPE-SEAL.md](V1-SCOPE-SEAL.md) — Scope boundary seal and deferred feature registry.
- [V1-PERSONA-ACCEPTANCE-MATRIX.md](V1-PERSONA-ACCEPTANCE-MATRIX.md) — Acceptance criteria verified across Host, Player, and Viewer personas.
- [PRODUCTION_READINESS_AND_DEPLOYMENT_REPORT.md](PRODUCTION_READINESS_AND_DEPLOYMENT_REPORT.md) — Production deployment and readiness assessment.

## 2. Capacity, Testing & Scenarios
- [GATE2-CAPACITY-REPORT.md](GATE2-CAPACITY-REPORT.md) — Free-tier capacity limits, Firestore read/write budgets, and concurrency gates.
- [V1-FULL-STRESS-REPORT.md](V1-FULL-STRESS-REPORT.md) — Multi-court concurrent match resolution and high-volume rush stress results.
- [V1-SCORE-RESILIENCE-SCENARIOS.md](V1-SCORE-RESILIENCE-SCENARIOS.md) — Score correction, network resilience, and recovery scenarios.
- [report.md](report.md) — Consolidated test execution and validation benchmarks.

## 3. Security & Compliance
- [FIREBASE-APP-CHECK-ROLLOUT.md](FIREBASE-APP-CHECK-ROLLOUT.md) — Firebase App Check rollout, monitoring, and reCAPTCHA Enterprise enforcement.
- [PADQ-FREE-API-SECURITY-AUDIT.md](PADQ-FREE-API-SECURITY-AUDIT.md) — Security audit covering Spark zero-spend boundaries and authorization.
- [firestore-security-audit.local.md](firestore-security-audit.local.md) — Local Firestore security rules audit and test evaluation.

## 4. Design, ADRs & Feature Specifications
- [V1-SUPERVISED-EVENT-RUNBOOK.md](V1-SUPERVISED-EVENT-RUNBOOK.md) — Host and coordinator step-by-step event runbook.
- [DESIGN_MATCHUP_DIFFERENTIAL.md](DESIGN_MATCHUP_DIFFERENTIAL.md) — Matchup differential, Point Differential (+/-), and 4-tier tiebreaker specification (Implemented in V1).
- [PADQ-RELEASE-ROADMAP.md](PADQ-RELEASE-ROADMAP.md) — Post-V1 roadmap and feature backlog.
- [PADQ-PROMPT.md](PADQ-PROMPT.md) — System architectural reference and prompt specifications.
- [adr/0001-dual-intent-sit-out.md](adr/0001-dual-intent-sit-out.md) — ADR 0001: Dual-intent sit-out and break handling.
- [adr/0002-deterministic-queue-eta.md](adr/0002-deterministic-queue-eta.md) — ADR 0002: Deterministic waiting queue ETA calculation.
- [adr/0003-priority-return.md](adr/0003-priority-return.md) — ADR 0003: Priority return from break vs back-of-queue return.
- [adr/0004-single-session-court-slots.md](adr/0004-single-session-court-slots.md) — ADR 0004: Single-session `courtSlots` multi-court architecture.
- [superpowers/specs/2026-11-05-compact-player-names-design.md](superpowers/specs/2026-11-05-compact-player-names-design.md) — Compact player display name specification (`formatDisplayName`).
- [superpowers/plans/2026-11-01-pre-session-checkin-and-engine-parity.md](superpowers/plans/2026-11-01-pre-session-checkin-and-engine-parity.md) — Pre-session check-in, smart paste, turn alerts, and engine parity plan.
- [superpowers/plans/2026-11-03-fix-six-live-wiring-bugs.md](superpowers/plans/2026-11-03-fix-six-live-wiring-bugs.md) — Live wiring parity and mobile touch target hardening plan.
- [superpowers/plans/2026-11-05-compact-player-names.md](superpowers/plans/2026-11-05-compact-player-names.md) — Compact player names implementation and verification plan.

## 5. Engineering Standards & Operational Guidelines
- [`.claude/guidelines/architecture.md`](../.claude/guidelines/architecture.md) — System design, boundary honesty, and one-way vs two-way doors.
- [`.claude/guidelines/observability-reliability.md`](../.claude/guidelines/observability-reliability.md) — Reliability patterns, idempotency, bounded retries, and error handling.
- [`.claude/guidelines/performance.md`](../.claude/guidelines/performance.md) — Performance workflow, algorithmic bounds, and Spark $0 cost discipline.
- [`.claude/guidelines/code-review.md`](../.claude/guidelines/code-review.md) — Prioritized code review hierarchy and PR discipline.
- [`.claude/guidelines/debugging.md`](../.claude/guidelines/debugging.md) — Scientific debugging, reproduction, and regression test prevention.

