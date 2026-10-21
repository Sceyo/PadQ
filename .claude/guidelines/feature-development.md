# Feature Development: Adding or Modifying a Feature

Applies when adding new behavior or changing existing behavior. Layers on the master `CLAUDE.md`.

## Before writing code
1. **Restate the feature as observable behavior.** "When a user does X, the system does Y, and Z is persisted/emitted." If you can't, ask.
2. **List acceptance criteria** (happy path, edge cases, failure modes). Confirm with the user if there is any ambiguity.
3. **Find the closest existing feature** and mirror its structure: routing, validation, service layer, persistence, tests, docs. Consistency beats novelty.
4. **Map the blast radius.** Who calls the code you will change? Search all callers, including tests, scripts, configs, and docs. For public interfaces (HTTP, CLI, events, DB schema, SDK), assume unknown consumers exist.
5. **Decide the rollout shape:** is this safe to ship in one step, or does it need a flag, a migration phase, or a deprecation window?

## Implementation order (vertical slice, thin first)
1. Write the failing test(s) for the primary acceptance criterion.
2. Implement the smallest end-to-end path that passes it.
3. Add edge cases and failure handling, one test each.
4. Wire up config, logging/metrics at meaningful decision points, and docs.
5. Run the full suite, lint, and type-check.

## Modifying existing behavior
- Prefer **additive** changes (new optional param, new field, new endpoint) over mutating existing contracts.
- If a breaking change is truly required: say so up front, list what breaks, propose a migration path, and wait for approval.
- Keep old behavior reachable behind a flag when the change is risky or user-visible. Name the flag, its default, and the removal condition.
- Don't change behavior and structure in the same commit. Refactor first (no behavior change, tests green), then change behavior.
- Update every place the old behavior was documented or asserted. Stale tests and docs are bugs.

## Checklist before declaring done
- [ ] Every acceptance criterion has a test that would fail without the change
- [ ] Inputs validated at the boundary; errors are specific and actionable
- [ ] No new dependency without approval
- [ ] Backwards compatibility considered (API, schema, config, persisted data)
- [ ] Idempotency and retry behavior considered for anything with side effects
- [ ] Authorization checked for every new entry point (see security.md)
- [ ] Logs contain no secrets or PII; key operations are observable
- [ ] Docs/changelog/OpenAPI updated if user-facing
- [ ] Diff contains nothing unrelated

## Anti-patterns
- Building a framework when a function would do
- Adding config knobs "just in case"
- Copy-pasting a similar feature and leaving vestigial code from the original
- Implementing the UI/API shape you'd prefer instead of the one requested
- Shipping a feature with only happy-path tests
