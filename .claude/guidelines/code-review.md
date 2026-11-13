# Code Review

Applies when reviewing a diff, PR, or the agent's own changes before reporting. Goal: catch defects and risks, improve clarity, and keep the codebase healthy, without bikeshedding.

## Review in this order (highest value first)
1. **Correctness:** Does it do what the request/spec says? Edge cases, error paths, off-by-one, null, concurrency, idempotency, ordering?
2. **Security:** authz, input handling, secrets, injection, data exposure (see security.md).
3. **Design fit:** Does it match the architecture and patterns? Right layer? Right abstraction level? Unnecessary complexity?
4. **Tests:** Do they exercise behavior and failure modes? Would they fail if the code were wrong?
5. **Operability:** logging, metrics, error messages, config, rollout/rollback, migration safety.
6. **Performance:** only where it matters (hot paths, N+1, unbounded loops/queries, memory).
7. **Readability & maintainability:** naming, structure, comments explaining *why*.
8. **Style:** defer to formatters/linters. Don't hand-review what a tool enforces.

## Scope discipline
- Review what changed and what it affects. Don't demand unrelated refactors.
- Flag unrelated issues as separate follow-ups, not blockers.
- Verify the diff matches the stated intent; call out drive-by changes.

## Comment format
Make every comment actionable and labeled:
- **[blocker]** must fix: bug, security issue, data-loss risk, broken contract
- **[suggestion]** would improve; author's call
- **[question]** I need to understand; may reveal a bug
- **[nit]** trivial, non-blocking
- **[praise]** call out genuinely good decisions

Explain *why* and, when helpful, show a concrete alternative. Critique the code, not the person. Be direct and kind.

## Self-review before reporting (agent)
- [ ] `git diff` read in full; every line traces to the request
- [ ] No debug code, commented-out code, stray files, or secrets
- [ ] No unrelated formatting churn
- [ ] Tests added/updated and run; results reported honestly
- [ ] Orphaned imports/vars made by my change removed
- [ ] Public interfaces and docs updated
- [ ] Risky areas and assumptions called out for the human reviewer

## Red flags worth a closer look
Swallowed exceptions; broad `catch`; TODOs without owners; new global state; time/randomness without injection; retries without backoff or idempotency; unbounded queries/loops/queues; auth checks missing on new routes; string-built queries; disabled lints/tests; copy-pasted blocks; boolean params that change behavior; functions doing several unrelated things; magic numbers; comments that restate code.
