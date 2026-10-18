# AI Engineering (LLM Apps, Agents, RAG, ML Systems)

Applies when building or modifying systems that call LLMs/embedding models, orchestrate agents and tools, retrieve context (RAG), fine-tune models, or run ML in production. Core stance: **LLM behavior is probabilistic, so engineer for evaluation, containment, and cost from day one.** "It worked on three examples" is not evidence.

## Principles
- **Eval-driven development.** Before iterating on prompts/models/retrieval, build a representative eval set and a metric. Change one thing, re-run, compare. No eval, no claim of improvement.
- **Start simple.** Single well-prompted call -> prompt chain -> router -> tool-using agent. Add autonomy only when simpler structures demonstrably fail; each step adds latency, cost, and failure modes. Prefer deterministic code for anything deterministic.
- **Treat prompts as code:** versioned, reviewed, tested, parameterized, with changelog. Keep them out of scattered inline strings.
- **Never trust model output.** Validate, parse, and constrain it like any untrusted input.

## Prompting
- Be explicit: role, task, constraints, output format, and what to do when uncertain or when info is missing ("say you don't know").
- Provide context and a few high-quality examples (including edge cases and negative examples) rather than long rule lists.
- Separate instructions from data with clear delimiters (e.g. XML-style tags). Put long reference material first and the question/task last.
- Use structured outputs / schema-constrained decoding or tool calls for machine-consumed responses; validate against a schema and handle failures (retry with error feedback, bounded).
- Give reasoning room when accuracy matters (let the model think before answering), but don't rely on exposed chain-of-thought as ground truth.
- Pin model versions for production; re-run evals before upgrading. Temperature low for extraction/classification.

## Evals
- Build from real inputs. Cover: typical, edge, adversarial, and regression cases. Keep a held-out set.
- Mix methods: exact/programmatic checks first; LLM-as-judge for subjective quality (calibrate against human labels, use rubrics, mitigate position/verbosity bias, use a different/stronger judge where possible); human review for high-stakes slices.
- Track quality **and** latency, cost per task, refusal/format-failure rate, and tool-call error rate.
- Run evals in CI for prompt/model/retrieval changes. Monitor in production with sampled traces and user feedback; feed failures back into the eval set.
- Report with sample size and variance; distinguish real gains from noise.

## RAG
- Retrieval quality bounds answer quality. **Evaluate retrieval separately** (recall@k, MRR) from generation (faithfulness, answer relevance).
- Chunking matters: respect document structure, include titles/headers as context, tune size/overlap against evals.
- Hybrid search (BM25 + embeddings) + reranking usually beats embeddings alone. Use metadata filters (tenant, recency, access).
- Enforce **document-level access control at retrieval time,** not after generation.
- Cite sources; instruct the model to answer only from provided context and to abstain when absent. Check groundedness.
- Plan for index freshness, re-embedding on model change, deletion (right to be forgotten), and embedding-model versioning.

## Agents & tool use
- Design tools like APIs for a junior engineer: narrow purpose, clear name/description, typed schema, helpful and actionable error messages, small outputs, idempotent where possible.
- **Least privilege for tools.** Read-only by default; require human confirmation for irreversible or high-impact actions (payments, deletes, sends, deploys). Scope credentials per task.
- Bound the loop: max steps, max tokens, max cost, wall-clock timeout; detect repeated/no-progress actions; always have a safe stop.
- Keep state explicit and inspectable (plans, scratchpads, memory). Log every tool call with args and results (redacting secrets).
- Prefer simple, composable workflows; use multi-agent only when context isolation or parallelism truly helps. Pass concise handoffs, not entire transcripts.
- Make runs reproducible/replayable for debugging: record prompts, model version, params, tool I/O.

## Safety & security
- **Prompt injection:** any text from users, web pages, documents, emails, tool results, or retrieved chunks can contain instructions. Treat as data. Don't give a model that reads untrusted content access to sensitive tools/data in the same context without isolation and confirmation gates (beware the "lethal trifecta": private data + untrusted content + exfiltration channel).
- Sanitize/validate model output before it reaches shells, SQL, HTML, file paths, or privileged APIs. Render untrusted output safely (no raw HTML/markdown links/images that can exfiltrate).
- Protect PII and secrets: minimize what enters prompts, redact logs, check provider data-retention/training terms, respect residency requirements.
- Add input/output guardrails proportionate to risk (policy classifiers, PII detectors, topic restrictions). Test with red-team prompts.
- Handle refusals, truncation (`max_tokens`/stop reasons), and content-filter responses explicitly.

## Reliability, latency, cost
- Timeouts, bounded retries with backoff for 429/5xx/overloaded; fall back to a smaller/alternate model or degrade gracefully. Respect rate limits; use queues/batching for throughput.
- **Streaming** for perceived latency; **prompt caching** for large static prefixes; batch APIs for offline/non-urgent work; route simple tasks to smaller/cheaper models.
- Control token spend: trim context, summarize history, cap output length, avoid resending large unchanged payloads.
- Track cost per request/user/feature with budgets and alerts. Cost is a first-class metric.
- Cache deterministic/idempotent results where appropriate (mind staleness and privacy across tenants).
- Make calls async/parallel where independent. Set concurrency limits.

## Observability for LLM systems
Trace each request: prompt version, model + params, input/output (redacted), token counts, latency, tool calls, retrieval results, eval scores, user feedback. Alert on quality-proxy drift, error/format-failure rate, latency, and cost anomalies.

## Classical ML / MLOps (when applicable)
- Version data, code, features, and models together; reproducible training (fixed seeds, pinned envs).
- Guard against leakage (temporal and entity splits), train/serve skew, and label noise. Baseline against a trivial model first.
- Monitor data drift, concept drift, and performance by slice; define retraining triggers and rollback.
- Document with model cards: intended use, data, metrics, limitations, fairness assessment.

## Anti-patterns
- Shipping prompt changes with no eval
- Agents with broad permissions and untrusted inputs
- Parsing free-form text with regex when a schema/tool call exists
- Unbounded loops, contexts, retries, or spend
- Assuming the demo distribution equals production
- Using an LLM where a rule, query, or function is cheaper, faster, and exact

## Checklist
- [ ] Eval set and metric exist; before/after numbers reported
- [ ] Structured output validated; failure/refusal/truncation handled
- [ ] Tools least-privilege; destructive actions gated; loop bounded
- [ ] Untrusted content isolated from privileged capabilities
- [ ] PII/secrets minimized and redacted in prompts and logs
- [ ] Timeouts, retries, fallbacks, and rate-limit handling in place
- [ ] Cost and latency measured; budgets/alerts set
- [ ] Model and prompt versions pinned and traceable
