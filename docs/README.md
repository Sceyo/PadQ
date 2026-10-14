# Documentation Index

This directory contains the operational, architectural, testing, and release documentation for PAD-Q.

---

## 🚀 V1.2 Documentation (Active Development)
Documentation for V1.2 features, including the revived Skill-Aware Matchmaking engine:
- [v1.2/ARCHITECTURE_AND_ANALYSIS.md](v1.2/ARCHITECTURE_AND_ANALYSIS.md) — Architectural design, option trade-off matrix, ADR-0005, and empirical analysis adhering to enterprise guidelines.
- [v1.2/SKILL_AWARE_MATCHMAKING.md](v1.2/SKILL_AWARE_MATCHMAKING.md) — Functional specification, priority cascades (P1–P3B), snake-draft team ordering, and dual-projection court synchronization.

---

## 📦 V1 Documentation (Production Baseline)
Historical and operational documentation governing the V1.0 release baseline:

### 1. Release & Verification
- [v1/V1-RELEASE-GATES.md](v1/V1-RELEASE-GATES.md) — Definitive release gates, requirements, and sign-offs for production launch.
- [v1/V1-PUBLIC-RELEASE-TASKS.md](v1/V1-PUBLIC-RELEASE-TASKS.md) — Public release checklist, open testing validation, and verification status.
- [v1/GATE4-RELEASE-CANDIDATE.md](v1/GATE4-RELEASE-CANDIDATE.md) — Release candidate qualification audit and verification logs.
- [v1/V1-SCOPE-SEAL.md](v1/V1-SCOPE-SEAL.md) — Scope boundary seal and deferred feature registry.
- [v1/V1-PERSONA-ACCEPTANCE-MATRIX.md](v1/V1-PERSONA-ACCEPTANCE-MATRIX.md) — Acceptance criteria verified across Host, Player, and Viewer personas.
- [v1/PRODUCTION_READINESS_AND_DEPLOYMENT_REPORT.md](v1/PRODUCTION_READINESS_AND_DEPLOYMENT_REPORT.md) — Production deployment and readiness assessment.

### 2. Capacity, Testing & Scenarios
- [v1/GATE2-CAPACITY-REPORT.md](v1/GATE2-CAPACITY-REPORT.md) — Free-tier capacity limits, Firestore read/write budgets, and concurrency gates.
- [v1/V1-FULL-STRESS-REPORT.md](v1/V1-FULL-STRESS-REPORT.md) — Multi-court concurrent match resolution and high-volume rush stress results.
- [v1/V1-SCORE-RESILIENCE-SCENARIOS.md](v1/V1-SCORE-RESILIENCE-SCENARIOS.md) — Score correction, network resilience, and recovery scenarios.
- [v1/report.md](v1/report.md) — Consolidated test execution, suggestions tracking, and validation benchmarks.

### 3. Security & Compliance
- [v1/FIREBASE-APP-CHECK-ROLLOUT.md](v1/FIREBASE-APP-CHECK-ROLLOUT.md) — Firebase App Check rollout, monitoring, and reCAPTCHA Enterprise enforcement.
- [v1/PADQ-FREE-API-SECURITY-AUDIT.md](v1/PADQ-FREE-API-SECURITY-AUDIT.md) — Security audit covering Spark zero-spend boundaries and authorization.
- [v1/firestore-security-audit.local.md](v1/firestore-security-audit.local.md) — Local Firestore security rules audit and test evaluation.

### 4. Design & Operations
- [v1/V1-SUPERVISED-EVENT-RUNBOOK.md](v1/V1-SUPERVISED-EVENT-RUNBOOK.md) — Host and coordinator step-by-step event runbook.
- [v1/DESIGN_MATCHUP_DIFFERENTIAL.md](v1/DESIGN_MATCHUP_DIFFERENTIAL.md) — Point Differential (+/-) and Matchup Strength (OWP) algorithm specification.

---

## 🗺️ System Roadmap & Standards
- [PADQ-RELEASE-ROADMAP.md](PADQ-RELEASE-ROADMAP.md) — Post-V1 roadmap and version backlog (V1.0 through V2.0).
- [PADQ-PROMPT.md](PADQ-PROMPT.md) — System architectural reference and prompt specifications.
