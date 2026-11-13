# Testing

Applies whenever writing, changing, or relying on tests. A test suite is a tool for **fast, trustworthy feedback**. Optimize for confidence per second of runtime.

## Principles
- Test **behavior**, not implementation. A good test survives refactoring and fails when behavior breaks.
- A test you haven't seen fail is not proven to test anything. For bug fixes, watch the new test fail before the fix, then pass after.
- One reason to fail per test; name it by behavior: `rejects_expired_token`, not `test1`.
- Arrange / Act / Assert, readable top to bottom. Prefer explicit values over clever helpers; tests are documentation.
- Tests are deterministic and isolated: no reliance on order, wall-clock time, randomness (seed or inject), network, or shared state. Inject clocks and ID generators.

## What to test (risk-weighted)
1. Business rules and invariants
2. Boundaries and edge cases: empty, one, many, max, negative, null, unicode, huge, duplicate, concurrent
3. Failure paths: timeouts, partial failures, invalid input, permission denied, dependency errors
4. Contracts at module/service boundaries
5. Regressions: every fixed bug gets a test

Don't write tests that: assert on mocks you just configured, duplicate the implementation, check trivial getters, or lock in incidental details (log strings, private method calls, field order).

## The pyramid (adapt to the system)
- **Unit:** fast, pure logic, many. 
- **Integration:** real DB/queue/filesystem (containers/testcontainers) for persistence and wiring, fewer.
- **Contract:** consumer-driven or schema tests between services/APIs.
- **End-to-end:** few, critical user journeys only; keep stable.
- **Property-based / fuzz:** for parsers, serializers, invariants, state machines.
- **Non-functional:** load, soak, chaos, and security tests where requirements demand.

## Mocking policy
- Mock at **system boundaries you don't own** (third-party HTTP, payment, email). Prefer fakes/in-memory implementations or recorded contract-verified stubs over deep mocks.
- Don't mock the thing under test or your own database in tests that exist to verify persistence.
- Over-mocked tests pass while production fails. When in doubt, use the real component.

## Working with existing tests
- Run the relevant tests **before** changing code to get a baseline. Know what was already failing.
- **Never** delete, skip, or loosen a test to get green unless the test is demonstrably wrong; if so, explain why and get approval.
- When behavior intentionally changes, update the test in the same change and say so.
- Match the existing framework, layout, naming, and fixtures. Don't introduce a new test library.

## Flaky tests
Treat as bugs. Reproduce in a loop, capture seed/logs, find shared state/time/order/concurrency. Quarantine only with an owner, an issue, and a deadline. Never "fix" with arbitrary sleeps.

## Coverage
Coverage finds untested code; it doesn't prove quality. Don't chase a number. Prioritize mutation testing or targeted review for critical modules. A failing path with an assertion beats ten lines of green with none.

## Test data
Use builders/factories with sensible defaults, overriding only what the test cares about. Never use real customer data. Keep fixtures small.

## Reporting
State: which tests you added/changed, what you ran, exact command, and pass/fail counts. If you couldn't run them, say so.
