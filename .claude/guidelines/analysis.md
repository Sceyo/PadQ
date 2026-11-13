# Analysis & Investigation

Applies when the task is to understand, evaluate, or explain rather than change: codebase exploration, root-cause analysis, technical due diligence, performance or cost analysis, data analysis, log/metric review, and recommendations. Output is **conclusions backed by evidence**.

## Principles
- **Define the question first.** What decision will this analysis inform? What would change the answer? Restate it; confirm if ambiguous.
- **Evidence over assertion.** Every non-trivial claim cites its source: file and line, query and result, log excerpt, benchmark, doc link. If you can't cite it, mark it as inference.
- **Separate observation, inference, and recommendation.** Label each. Don't blur "the code does X" with "the author intended Y."
- **Report confidence and gaps.** What you checked, what you didn't, what would change your conclusion.
- **Seek disconfirming evidence.** Actively try to prove your leading hypothesis wrong before reporting it.
- **Read-only by default.** Analysis shouldn't modify code, data, or systems. If you must run something, prefer read-only, bounded, local.

## Codebase exploration
1. Find entry points (main, routes, handlers, jobs, CLI) and trace outward.
2. Follow one real request/data path end to end before generalizing.
3. Read tests and recent git history (`git log -p`, `git blame`) for intent and gotchas.
4. Build a short map: components, responsibilities, dependencies, data stores, external calls.
5. Note smells and risks (coupling, missing tests, dead code, hidden global state), but don't fix them.

## Data analysis
- Inspect before analyzing: shape, types, nulls, duplicates, ranges, units, time zones, sampling bias.
- State the population and filters. Check joins don't duplicate or drop rows (compare counts before/after).
- Prefer simple, explainable methods first. Show the numbers, not just the chart.
- Distinguish correlation from causation; check for confounders, Simpson's paradox, survivorship bias, and small samples. Report uncertainty (intervals, variance), not just point estimates.
- Make it reproducible: script/notebook, fixed seeds, recorded versions, documented data source and date.
- Sanity-check magnitudes against known anchors.

## Cost / performance / capacity analysis
- Establish baseline and workload definition. Measure in a representative environment.
- Break down by component; find the dominant term (Amdahl's law) before optimizing minor ones.
- Give order-of-magnitude estimates with explicit assumptions; show sensitivity to the 1-2 assumptions that matter most.

## Comparing options
Use a table: criteria x options, with weights if the user cares. Include "do nothing" as an option. Recommend one, state the tradeoffs, and name the trigger that would change the recommendation.

## Output template
```
## Question
## Bottom line (1-3 sentences, with confidence level)
## Evidence
  - finding -> source (file:line / query / log / link)
## Analysis
  Observations | Inferences | Unknowns
## Recommendation(s)
  ordered by impact/effort, with risks
## What I did not check
```

Keep it as short as the question allows. Lead with the answer.
