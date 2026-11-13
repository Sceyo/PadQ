# API Design

Applies to HTTP/REST, GraphQL, gRPC, CLI, SDK, event/message contracts, and library public interfaces. A public interface is a **promise**. Assume unknown consumers and that you can't change it cheaply later.

## Principles
- **Design from the consumer's use case,** not from your internal data model. Write the example call and response first.
- **Be consistent.** Naming, casing, pagination, errors, auth, and timestamps behave the same everywhere. Follow the existing API's conventions over external "best practice."
- **Be conservative in what you expose, additive in how you evolve.** Adding optional fields is safe; removing, renaming, or changing meaning is breaking.
- **Make the wrong thing hard.** Required fields explicit, enums closed, units in names or types, no ambiguous booleans.

## HTTP/REST essentials
- Resource-oriented nouns; correct verbs: `GET` safe/idempotent, `PUT`/`DELETE` idempotent, `POST` for creation/non-idempotent actions, `PATCH` for partial updates.
- Correct status codes: 200/201/202/204, 400 (malformed), 401 (unauthenticated), 403 (forbidden), 404, 409 (conflict), 412/428 (preconditions), 422 (semantic validation), 429 (rate limited), 5xx (server fault only).
- **Idempotency keys** for retried mutations (payments, orders, provisioning).
- **Pagination** on every list endpoint; prefer cursor-based. Enforce a max page size. Stable sort order.
- Filtering/sorting via explicit, allow-listed params. Never accept arbitrary field names or operators into queries.
- **Errors:** consistent machine-readable shape (e.g. RFC 9457 problem+json): stable `code`, human `message`, optional `details`/field errors, and a `request_id`. Never leak internals.
- Timestamps in ISO-8601 UTC; money as integer minor units + currency; IDs as opaque strings.
- Use ETags / `If-Match` for optimistic concurrency where lost updates matter.
- Rate limits with `Retry-After`; document them.
- Long-running work: return `202` with a status resource; support webhooks/polling.

## Versioning & compatibility
- Pick one strategy (URL or header) and use it consistently. Version only on breaking change.
- Deprecation: announce, add `Deprecation`/`Sunset` headers, measure usage, remove only after consumers migrate.
- **Tolerant reader:** clients ignore unknown fields; servers ignore unknown *optional* input only where safe.
- Never reuse removed field names/IDs with new meaning (critical for protobuf/Avro field numbers).
- Contract tests and schema diffing in CI (OpenAPI/protobuf/GraphQL schema checks) to catch accidental breaks.

## Events & messaging
- Event = past-tense fact with id, type, version, timestamp, and producer. Schema-registered and versioned.
- Consumers must be **idempotent**; delivery is at-least-once. Define ordering/partition key explicitly.
- Provide a dead-letter path and replay story.

## Library / SDK interfaces
- Minimal public surface; everything else private. Document and test the public API.
- Fail loudly with actionable errors. Avoid boolean trap params; prefer options objects/enums.
- Semantic versioning, changelog, and migration notes.

## Security & operability
AuthN/Z on every operation (object-level), input validation, size limits, timeouts, request IDs/tracing headers, and structured access logs (see security.md, observability-reliability.md).

## Checklist
- [ ] Example request/response written and reviewed
- [ ] Consistent with existing conventions
- [ ] Backward compatible, or breaking change explicitly approved with migration plan
- [ ] Pagination, limits, idempotency, and error contract defined
- [ ] OpenAPI/proto/schema updated; contract tests added
- [ ] Authorization semantics documented and tested
