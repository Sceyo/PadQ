# Performance

Applies when making code faster, cheaper, or more scalable. **Measure, don't guess.** "Premature optimization is the root of all evil" applies, but so does ignoring complexity you can see (N+1, O(n^2) on user-sized data).

## Workflow
```
1. Define     -> the metric (p50/p95/p99 latency, throughput, memory, cost) and the target
2. Baseline   -> measure in a representative setup; record numbers and variance
3. Profile    -> find the actual bottleneck (CPU, memory, I/O, lock contention, network, DB)
4. Hypothesize-> what change should help and by how much?
5. Change one thing -> smallest possible
6. Re-measure -> compare against baseline; keep only wins
7. Guard      -> add a benchmark/alert so it doesn't regress
```
If you can't state the target and baseline, you aren't ready to optimize.

## Where the wins usually are (check in this order)
1. **Do less work:** avoid unnecessary calls, queries, serialization, and loops. Cache computed results with a clear invalidation story.
2. **Better algorithm / data structure:** O(n^2) -> O(n log n); hash lookups; indexes.
3. **I/O:** batch requests, reduce round trips, connection pooling, pagination/streaming, compression, parallelize independent calls (with concurrency limits).
4. **Database:** missing index, N+1, over-fetching, lock contention, bad plan (see database.md).
5. **Memory/allocation:** avoid copying large data, unbounded caches/collections, leaks, GC pressure.
6. **Concurrency:** right-size pools; avoid blocking the event loop; remove lock contention.
7. **Micro-optimizations:** last, only on proven hot paths.

## Rules
- Optimize the **bottleneck**, not the code you find interesting. A 10x improvement to 2% of runtime yields ~2%.
- Use percentiles, not averages. Tail latency dominates user experience and compounds across fan-out calls.
- Benchmark properly: warm-up, enough iterations, realistic data sizes, isolate noise, report variance. Beware benchmarks the compiler/JIT can eliminate.
- Don't trade away correctness, readability, or safety for unmeasured gains. Document non-obvious optimizations with the measured reason.
- Caches: define key, TTL, size bound, invalidation, and stampede protection. A cache that's wrong is worse than none.
- Load test before and after for scale claims; watch saturation (utilization, queue depth, errors), not only latency.
- Think about **cost** as a performance dimension on cloud: right-size, autoscale, avoid cross-AZ/egress chatter, use storage tiers.

## Report
Baseline vs after (same method), what changed, why it helps, tradeoffs introduced, and how regressions will be caught.
