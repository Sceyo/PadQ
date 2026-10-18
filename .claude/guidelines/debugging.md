# Debugging

Applies when diagnosing a bug, failing test, crash, regression, or "it works on my machine." The goal is a **proven root cause and a minimal fix**, not a plausible-sounding guess.

## Principles
- **Reproduce first.** No fix without a reliable reproduction (test, script, or exact steps). If you cannot reproduce, say so and gather more data. Don't guess-fix.
- **Hypothesize, then falsify.** Write down 2-4 candidate causes ranked by likelihood. Design the cheapest experiment that distinguishes them. Change one variable at a time.
- **Distrust assumptions.** The bug is where your mental model is wrong. Check what you "know" is true: the deployed version, the config actually loaded, the env var actually set, the input actually received.
- **Read the error.** Full message, full stack trace, first and last frames, the *first* error in the log (later ones are often cascades).
- **Fix the cause, not the symptom.** Swallowing an exception, adding a retry, or adding a null-check around a crash is not a fix unless you can explain why that is the correct behavior.

## Workflow
```
1. Observe     -> exact symptom, expected vs actual, when it started, how often
2. Reproduce   -> minimal failing case; make it a test
3. Isolate     -> bisect (git bisect, input halving, disabling components, feature flags)
4. Hypothesize -> ranked list with the evidence for/against each
5. Experiment  -> one change at a time; log what you tried and the result
6. Root cause  -> explain the full causal chain in plain language
7. Fix         -> smallest change that removes the cause
8. Verify      -> repro test passes; related tests pass; no new warnings
9. Prevent     -> regression test; consider why it wasn't caught earlier
```

## Techniques (pick what fits)
- **Binary search the history:** `git bisect` with a repro script for regressions.
- **Binary search the input:** shrink the failing payload until it's minimal.
- **Binary search the system:** which layer first shows wrong data? Log at boundaries (in/out of each component).
- **Diff the environments:** versions, env vars, config, data, OS, locale, timezone, clock, CPU arch, feature flags.
- **Look for the usual suspects:** off-by-one, null/undefined, mutable shared state, async ordering and race conditions, timezone/DST, encoding, integer overflow, float comparison, cache staleness, connection pool exhaustion, N+1, retries causing duplicates, resource leaks.
- **Flaky tests:** treat as real bugs. Suspect shared state, time, ordering, concurrency, network, randomness. Run in a loop with the seed logged. Never fix by adding `sleep` or retries without understanding why.
- **Concurrency bugs:** reason about happens-before; prefer eliminating shared mutable state over adding locks.
- **Production-only bugs:** collect logs, traces, metrics, recent deploys/config changes first. Don't attach debuggers or change prod without approval.

## Instrumentation rules
- Add temporary logging/prints freely, but **remove them before finishing** (they count as your own mess).
- Never log secrets, tokens, or personal data while debugging.
- Prefer structured, greppable log lines with a unique tag you can remove cleanly.

## Reporting a diagnosis
```
Symptom:       what was observed
Root cause:    the actual defect and why it produces the symptom
Evidence:      how I know (repro, logs, experiment results)
Fix:           what changed (minimal)
Verification:  test added / what now passes
Confidence:    high | medium | low, and what would raise it
Also noticed:  related risks left untouched
```

If after reasonable effort the cause is still unknown, report what you ruled out, what you suspect, and what data you need. A clear dead-end report is better than a speculative patch.
