# Database

Applies to schema design, queries, migrations, ORMs, indexing, transactions, and data fixes. Data outlives code: be conservative, reversible, and explicit. **Never run anything against a non-local database without approval.**

## Hard rules
- **Migrations are code:** versioned, reviewed, committed, repeatable. Never hand-edit a schema outside a migration.
- **Never run destructive statements** (`DROP`, `TRUNCATE`, unbounded `DELETE`/`UPDATE`) without approval. Always show the exact statement and the row count it will affect first (`SELECT count(*)` with the same `WHERE`).
- **Never** touch production data from an agent session. Prepare the script and a rollback plan; a human runs it.
- Always use parameterized queries. No string-built SQL (see security.md).
- Back up (or confirm a recent restorable backup/PITR) before any risky change.

## Schema design
- Model the domain first; normalize to 3NF by default, denormalize deliberately with a measured reason.
- Every table: primary key, `created_at`, and `updated_at` where useful. Choose key types consciously (UUIDv7/ULID for distributed + index locality; bigint identity for simplicity).
- Enforce invariants in the database: `NOT NULL`, `UNIQUE`, `CHECK`, foreign keys. App-level validation alone isn't enough.
- Use correct types: `timestamptz`/UTC for time, `numeric`/integer cents for money (never float), enums/lookup tables for closed sets, `jsonb` for genuinely semi-structured data only.
- Plan soft-delete vs hard-delete, retention, and PII handling up front.
- Multi-tenancy: tenant id in every tenant-owned table, in every index that needs it, and enforced (row-level security or a mandatory filter).

## Migrations: safe by default (zero-downtime mindset)
Use **expand -> migrate -> contract**:
1. **Expand:** add new nullable column/table/index (backward compatible with running code).
2. **Deploy** code that writes both / reads new with fallback.
3. **Backfill** in small batches, throttled, resumable, idempotent.
4. **Switch** reads; verify.
5. **Contract:** remove old column/code in a *later* release.

Rules:
- One logical change per migration. Include a tested `down`, or document why it's irreversible.
- Avoid long locks: in Postgres use `CREATE INDEX CONCURRENTLY`, add constraints as `NOT VALID` then `VALIDATE`, avoid rewriting large tables, set `lock_timeout`/`statement_timeout`.
- Adding `NOT NULL` or a default to a large table can lock or rewrite depending on engine/version. Check your DB's behavior.
- Never rename or drop a column used by running code in the same release. Old and new app versions coexist during deploys.
- Test migrations on a production-sized copy when the table is large. Time them.

## Queries & performance
- Look at the **plan** (`EXPLAIN (ANALYZE, BUFFERS)`), not your intuition. Measure before and after.
- Index for actual access patterns: equality columns first, then range; consider covering/partial indexes. Every index costs writes and storage; don't add speculatively. Drop unused ones deliberately.
- Avoid: `SELECT *` in application code, N+1 (batch or join), unbounded result sets (paginate; prefer keyset over deep `OFFSET`), functions on indexed columns in `WHERE`, implicit type casts, leading-wildcard `LIKE`.
- Keep transactions **short**. No network calls or user waits inside a transaction.
- Use the right isolation level knowingly. Handle serialization failures/deadlocks with bounded retries. Acquire locks in a consistent order.
- Use `SELECT ... FOR UPDATE SKIP LOCKED` for queue-like patterns; optimistic concurrency (version column) for user-driven edits.
- Idempotent writes: unique constraints + `INSERT ... ON CONFLICT` (or equivalent) rather than check-then-insert.

## ORM usage
- Know what SQL it emits; log it in dev. Watch for lazy-loading N+1 and accidental full-table loads.
- Drop to raw SQL for complex reporting, but parameterize and test.
- Don't let ORM models leak into API contracts.

## Data fixes & backfills
1. Write a read-only query that identifies exactly the affected rows. Review the count and a sample.
2. Write the fix as a script/migration with batching, logging, and dry-run mode.
3. Make it idempotent and resumable. Record before-state for rollback.
4. Run on a copy/staging first. Hand off to a human for production.

## Choosing a store
Default to a relational DB (Postgres) until a requirement says otherwise. Use specialized stores for specialized needs: Redis for ephemeral/cache/rate-limit, object storage for blobs, search engine for full-text, columnar warehouse for analytics, vector index (or pgvector) for embeddings. Don't make a cache the source of truth.

## Checklist
- [ ] Constraints and types enforce invariants
- [ ] Migration is backward compatible with the currently deployed code
- [ ] Locking/runtime impact understood on production-scale data
- [ ] Indexes justified by a concrete query; plan checked
- [ ] Rollback or forward-fix path documented
- [ ] Backfill is batched, idempotent, resumable
- [ ] No PII leaks into logs, fixtures, or non-prod copies
