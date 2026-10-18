# Refactoring

Applies when restructuring code **without changing behavior**. Refactoring is only safe with a safety net, and only valuable with a concrete goal.

## Preconditions
- **State the goal** (e.g. "make X testable," "remove duplication that caused bug Y," "unblock feature Z"). No goal, no refactor.
- **Get a green baseline.** Run the tests first. If coverage of the affected behavior is thin, add **characterization tests** that pin current behavior (even quirky behavior) before touching anything.
- Confirm scope with the user. Refactors expand easily; fence the boundary and stick to it.

## Rules
- **Behavior must not change.** If you discover a bug, don't fix it inside the refactor. Pin it with a test, report it, and fix it in a separate change.
- **Never mix refactoring with feature or bug-fix changes** in one commit.
- **Small, reversible steps.** Each step compiles and passes tests. Commit frequently so any step can be reverted.
- Prefer mechanical, tool-assisted transformations (IDE rename/extract, codemods) over hand edits for wide changes. Review the result.
- Preserve public interfaces, or migrate callers in the same change and say so. Use deprecation + shim for widely used APIs.
- Match the codebase's conventions. The goal is consistency, not your preferred style.

## Common moves (apply only when the goal calls for them)
- Extract function / variable to name a concept; inline when the name adds nothing
- Rename for clarity (names are the cheapest documentation)
- Move code to where its data lives; break import cycles
- Replace conditionals with polymorphism/strategy **only** when variants actually multiply
- Introduce a seam (interface, dependency injection) to make code testable
- Delete dead code **you proved** is unused (search all references, reflection, configs, dynamic dispatch). If it's pre-existing and unrelated, mention it instead.

## Large refactors
- **Strangler fig:** build the new path beside the old one, route traffic incrementally, delete the old path last.
- **Branch by abstraction:** introduce an interface, migrate callers one by one, swap the implementation.
- Keep the system shippable at every step. No long-lived mega-branches.
- Add metrics/logging to compare old vs new behavior (shadow mode / dual-run) for risky paths.

## Verification
- Tests pass before and after, with identical results.
- Diff review: is every change structural? Any accidental semantic change (evaluation order, short-circuiting, null handling, float math, ordering, error types)?
- Performance sanity check for hot paths.

## Report
What structure changed, why, how behavior was held constant (which tests), and what you deliberately did not touch.
