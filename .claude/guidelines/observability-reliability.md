# Observability & Reliability

Applies to logging, metrics, tracing, alerting, SLOs, incident response, error handling, and resilience patterns. You can't operate, debug, or improve what you can't see.

## Observability fundamentals
- **Three pillars + context:** logs (events), metrics (aggregates), traces (request paths), tied together by correlation/trace IDs propagated across every hop (W3C `traceparent`; OpenTelemetry by default).
- Instrument **at decision points and boundaries:** inbound requests, outbound calls, queue publish/consume, retries, fallbacks, state transitions, auth decisions.
- **Logs:** structured (JSON), leveled (`error` = needs human attention; don't cry wolf), with request/user/tenant IDs. One event per line, no multi-line stack spam without structure.
  - **Never log** secrets, tokens, full PII, payment data, or entire request bodies by default.
  - Don't log in tight loops; sample high-volume logs. Log volume is a cost.
- **Metrics:** RED for services (Rate, Errors, Duration); USE for resources (Utilization, Saturation, Errors). Use histograms for latency. **Avoid high-cardinality labels** (user IDs, raw URLs) as they explode cost and break backends.
- **Traces:** propagate context; name spans by operation; attach useful attributes; sample intelligently (tail-based for errors/slow).
- Business/health signals matter as much as technical ones (orders/min, sign-up success rate).

## SLOs & alerting
- Define SLIs users feel (availability, latency, correctness, freshness), set SLOs, track error budget. Let budget burn guide risk-taking vs stability work.
- **Alert on symptoms, not causes;** page only for things that need a human now and are actionable. Every alert links to a runbook. Prefer multi-window burn-rate alerts.
- Delete or fix noisy alerts. Alert fatigue is an outage waiting to happen.
- Dashboards answer specific questions (is it healthy? what changed? where is the time going?). Include deploy markers.

## Resilience patterns
- **Timeouts on every network call** (never default to infinite). Budget timeouts so inner < outer.
- **Retries:** bounded, exponential backoff + jitter, only for idempotent/transient failures. Beware retry storms; use retry budgets.
- **Circuit breakers / bulkheads** to contain failing dependencies; **load shedding & backpressure** over unbounded queues.
- **Graceful degradation:** define what the system does when a dependency is down (cached/stale data, reduced features, clear error).
- **Idempotency** for anything retried or redelivered; **dead-letter queues** with a replay path.
- Health checks: liveness (restart me) vs readiness (send me traffic) vs dependency checks. Don't make liveness depend on downstreams.
- Graceful shutdown: stop accepting work, drain in-flight, then exit.
- Chaos/failure testing: kill dependencies, add latency, test failover and restore *before* you need them.

## Error handling
- Handle errors where you can do something useful; otherwise propagate with added context (what operation, which inputs, not secrets).
- Distinguish expected (user error, not found) from unexpected (bug, outage) errors; different status codes, levels, and alerting.
- Don't swallow exceptions. Don't catch broad types unless re-raising or at a top-level boundary that logs and returns a safe response.
- Fail fast on invalid startup config.

## Deployments & change management
- Small, frequent, reversible changes. Feature flags to decouple deploy from release.
- Canary/progressive rollout with automatic rollback on SLO regression.
- Most incidents follow a change: make "what changed?" answerable in seconds (deploy log, config history, flag audit).

## Incident response (when assisting)
1. **Stabilize first:** mitigate user impact (rollback, disable flag, scale, fail over) before root-causing.
2. Establish timeline and blast radius; communicate status.
3. Gather evidence (dashboards, logs, traces, recent changes). Form and test hypotheses (see debugging.md).
4. After resolution: blameless postmortem, covering impact, timeline, root cause(s), what went well/poorly, **actionable follow-ups with owners**.
Don't take production-mutating actions without explicit human approval.

## Runbook template
```
Alert/Symptom:
Impact:
Dashboards/queries:
Likely causes (ranked):
Diagnostic steps:
Mitigations (safe first):
Escalation:
```

## Checklist for new services/features
- [ ] Request/error/latency metrics and a trace path exist
- [ ] Structured logs with correlation IDs; no sensitive data
- [ ] Timeouts, bounded retries, idempotency defined
- [ ] Degradation behavior defined and tested
- [ ] SLO/alert + runbook for user-impacting failure modes
- [ ] Rollback path and feature flag where risky
