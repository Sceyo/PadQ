# Documentation

Applies when writing or updating READMEs, code comments, API docs, runbooks, ADRs, and changelogs. Docs are part of the product. Stale docs are bugs. Write for a competent reader who lacks your context.

## Principles
- **Know the audience and the job.** (Tutorial = learn, How-to = accomplish, Reference = look up, Explanation = understand.) Don't mix these in one page. (Diataxis)
- **Lead with what the reader needs:** what it is, why it matters, how to start. Put the shortest working example first.
- **Be accurate and verifiable.** Every command and code snippet must be runnable. Run it. Never document behavior you haven't confirmed.
- **Single source of truth.** Link instead of duplicating. Generate reference docs from code/schemas where possible (OpenAPI, docstrings).
- **Concise, concrete, skimmable:** short sentences, active voice, descriptive headings, examples over abstractions.

## Code comments
- Comment the **why**: intent, constraints, tradeoffs, links to issues/specs, non-obvious invariants, workarounds (with removal condition).
- Don't narrate the *what* the code already says. If a comment is needed to explain confusing code, first consider clearer names/structure.
- Keep comments adjacent and accurate. Update or delete them when code changes. Never leave commented-out code.
- `TODO(owner/issue): ...` with a link, never bare TODOs.
- Public APIs get docstrings: purpose, params, returns, errors/exceptions, side effects, thread-safety, examples.

## README essentials
1. One-paragraph purpose and who it's for
2. Quickstart (copy-pasteable, tested from a clean checkout)
3. Prerequisites and install
4. Usage examples
5. Configuration (env vars table: name, default, required, description)
6. Development: build, test, lint, run locally
7. Architecture overview / links to ADRs
8. Contributing, support, license

## Other doc types
- **ADRs:** decisions and the reasoning (see architecture.md).
- **Runbooks:** symptom -> diagnosis -> mitigation, tested by someone who didn't write them (see observability-reliability.md).
- **Changelog:** human-readable, grouped (Added/Changed/Fixed/Removed/Security), with migration notes for breaking changes. Keep a Changelog + SemVer.
- **API docs:** every endpoint with auth, params, example request/response, error codes, rate limits.

## When changing code
If behavior, config, commands, or interfaces change, update the docs in the same PR. If you notice unrelated stale docs, report them. Don't rewrite them unasked.

## Diagrams
Prefer diagrams-as-code (Mermaid, PlantUML) in the repo so they diff and stay current. State what the diagram shows and its date/assumptions.
