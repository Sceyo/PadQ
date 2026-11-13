# Architecture & System Design

Applies when designing systems, choosing between approaches, introducing components, or making changes that are costly to reverse. Optimize for **changeability, operability, and clarity**, in that order.

## Principles
- **Start from requirements, not technology.** Capture functional needs and the non-functionals that drive design: scale (RPS, data size, growth), latency/throughput targets, availability/RPO/RTO, consistency needs, security/compliance, team size, budget, time-to-market.
- **Prefer the simplest architecture that meets today's requirements with a credible path to tomorrow's.** A modular monolith beats premature microservices. Add a queue/cache/service only when you can name the bottleneck or failure mode it removes.
- **Make decisions explicit and reversible where possible.** Distinguish one-way doors (data models, public APIs, vendor lock-in, wire formats) from two-way doors. Spend rigor on one-way doors.
- **Design for failure.** Everything on the network fails, is slow, or returns garbage. Define timeouts, retries (with backoff + jitter, bounded), idempotency, circuit breaking, and degradation behavior.
- **Own the data model.** Bad boundaries and bad schemas are the most expensive mistakes. Define who owns each piece of data and who may write it.
- **Keep boundaries honest.** Dependencies point inward (domain doesn't depend on infrastructure). Don't share databases across services. Don't leak internal types across module boundaries.

## Workflow for a design task
1. **Clarify** goals, constraints, non-goals, and success metrics. State assumptions.
2. **Sketch 2-3 viable options.** For each: how it works, what it costs (complexity, money, ops burden), what it's good at, how it fails.
3. **Compare against the stated non-functionals** in a small table. Recommend one and say what would change your mind.
4. **Identify risks and unknowns;** propose the cheapest spike/prototype to retire the biggest one.
5. **Define the migration/rollout path:** incremental, with checkpoints and a rollback.
6. **Record the decision** (ADR, below).

## Decision checklist
- **Data:** entities, ownership, consistency model (strong vs eventual), retention, PII classification, backup/restore, schema evolution
- **Interfaces:** sync vs async, contracts, versioning, backward compatibility, pagination, rate limits
- **Scalability:** what is the first bottleneck? Is state externalized so compute scales horizontally? Hot keys/partitions?
- **Reliability:** SPOFs, blast radius, bulkheads, graceful degradation, dependency SLAs, multi-AZ/region needs (only if justified)
- **Security:** trust boundaries, authN/authZ model, secrets, encryption in transit/at rest, tenant isolation, audit (see security.md)
- **Operability:** deploy strategy, config, observability, runbooks, on-call burden, cost visibility
- **Evolvability:** can a new engineer change one part without understanding all parts? Can we delete this later?
- **Cost:** order-of-magnitude estimate at expected and 10x load

## Patterns: use when the problem matches, not by default
- Queue/outbox for reliable async side effects (use the **transactional outbox** to avoid dual-write bugs)
- Idempotency keys for any retried mutation
- CQRS/event sourcing only with a demonstrated need for audit/replay/read-scaling; they carry high complexity
- Saga/orchestration for multi-service workflows; prefer orchestration when you need visibility
- Cache-aside with explicit TTL and invalidation story; caches hide bugs, so know your source of truth
- Backpressure and load shedding over unbounded queues

## Anti-patterns
- Resume-driven design (new tech with no requirement behind it)
- Distributed monolith (microservices that must deploy together)
- Shared mutable database across services
- "We'll add observability/security later"
- Designing for 100x scale you don't have, while ignoring the failure modes you do have
- Diagrams with no stated assumptions or failure analysis

## ADR template (store in `docs/adr/NNNN-title.md`)
```
# NNNN. Title
Status: proposed | accepted | superseded by NNNN
Context: forces, constraints, requirements
Options considered: A, B, C (one line each, with tradeoffs)
Decision: what we chose and why
Consequences: positive, negative, risks, follow-ups
Revisit when: the trigger that should reopen this decision
```

## When implementing within an existing architecture
Follow it. If you believe it is wrong, say so and propose the change separately. Don't quietly introduce a competing pattern in a feature PR.
