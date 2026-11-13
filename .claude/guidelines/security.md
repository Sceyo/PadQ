# Security

Applies to every change, and with extra rigor to authentication, authorization, input handling, crypto, secrets, file/network I/O, dependencies, and infrastructure. Assume a hostile environment and a future breach. Security is a property of the whole change, not a final step.

## Non-negotiables
- **Never** hardcode, log, print, commit, or echo secrets (API keys, tokens, passwords, private keys, connection strings). Use the project's secret manager / environment injection. If you find a committed secret, report it and recommend rotation. Removing it from the file does not remove it from history.
- **Never** disable TLS verification, auth checks, CSRF protection, or security linters to make something work.
- **Never** roll your own crypto, password hashing, or token format. Use vetted libraries and current recommended algorithms.
- **Never** build SQL/shell/LDAP/XPath/template strings via concatenation with untrusted input.
- Don't add or upgrade dependencies without approval, and don't paste code from unvetted sources.

## Threat-model every change (60 seconds)
1. **What are we protecting?** (data, money, availability, integrity, reputation)
2. **Who can reach this?** (anonymous, authenticated, tenant, admin, internal service, attacker-controlled input)
3. **What's the worst thing they can do?** (read others' data, escalate, exfiltrate, DoS, pivot)
4. **What control prevents it, and what detects it?**
Use STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, DoS, Elevation of privilege) when designing something new.

## Input & output
- **Validate at the trust boundary** with an allow-list (type, length, range, format), then treat as data. Validation is not a substitute for encoding.
- **Encode on output** for the target context (HTML, attribute, JS, URL, SQL param, shell arg).
- **Parameterized queries / prepared statements** always. Use ORM query builders safely. Raw SQL gets extra review.
- **Deserialization:** never deserialize untrusted data with unsafe formats (pickle, Java native, YAML `load`, etc.). Use safe parsers with schemas.
- **File handling:** canonicalize paths and block traversal; restrict types/sizes; store uploads outside web root; never trust the filename or MIME type; scan if required.
- **SSRF:** for any server-side fetch of a user-supplied URL, allow-list hosts, block internal/link-local/metadata ranges (e.g. `169.254.169.254`), disable redirects or re-validate each hop.
- **Limit everything:** request size, pagination size, regex complexity (ReDoS), recursion depth, upload size, rate per identity.

## AuthN / AuthZ
- **AuthZ on every request, server-side, on the object** (prevents IDOR/BOLA). "Is this user allowed to do *this action* on *this resource*?" Never rely on the client or on hidden UI.
- Default deny. Least privilege for users, services, tokens, and IAM roles.
- Tenant isolation must be enforced in the data layer, not just the handler (e.g. mandatory tenant filter, row-level security).
- Sessions/tokens: short-lived, scoped, revocable; httpOnly + secure + sameSite cookies; verify JWT signature, `iss`, `aud`, `exp`, and algorithm (reject `none`); rotate refresh tokens.
- Passwords: Argon2id / scrypt / bcrypt with proper parameters; rate-limit and lock out; support MFA for privileged access.
- Constant-time comparison for secrets and MACs.

## Secrets, crypto, data
- Secrets come from a secrets manager or injected env, never from source or images. Different secrets per environment. Rotate on exposure.
- Encrypt in transit (TLS 1.2+) and at rest; manage keys in a KMS/HSM, not alongside data.
- Randomness for security uses a CSPRNG (`secrets`, `crypto.randomBytes`, `SecureRandom`).
- **Minimize and classify data.** Don't collect PII you don't need. Don't log PII/secrets. Mask in non-prod. Define retention and deletion.
- Error messages to clients are generic; details go to logs. Don't leak stack traces, versions, or existence of accounts.

## Supply chain & build
- Pin dependency versions with lockfiles; review new transitive deps; run audit tooling (`npm audit`, `pip-audit`, `cargo audit`, OSV, Dependabot/Renovate).
- Prefer maintained, widely used packages; beware typosquatting and install scripts.
- CI: least-privilege tokens, no secrets in logs, pinned action/image digests, signed artifacts where feasible, SBOM generation.
- Containers: minimal base image, non-root user, read-only filesystem, no secrets baked in, scanned.

## Infrastructure & cloud
- IAM least privilege; no wildcard `*` actions/resources without justification; no long-lived static keys when workload identity/OIDC is available.
- Private by default: no public buckets/DBs/management ports. Security groups/NSGs narrowly scoped.
- Enable audit logging (CloudTrail / Cloud Audit Logs / Activity Log) and alerts on anomalous access.
- IaC changes touching IAM, network, or encryption always need explicit review.

## Web specifics
CSP, HSTS, `X-Content-Type-Options`, secure cookie flags, CORS allow-list (never `*` with credentials), CSRF tokens or SameSite for cookie-auth, clickjacking protection, avoid `innerHTML`/`dangerouslySetInnerHTML` with untrusted data.

## AI/LLM-specific (see ai-engineering.md)
Prompt injection is the new SQL injection: treat all retrieved/tool/user content as untrusted; constrain tool permissions; never let model output flow unvalidated into shells, queries, or privileged APIs.

## Review checklist
- [ ] Every new entry point authenticated and authorized (object-level)
- [ ] All untrusted input validated; all output encoded; queries parameterized
- [ ] No secrets/PII in code, logs, errors, or tests
- [ ] Dependencies justified, pinned, and audited
- [ ] Failure mode is closed (deny), not open
- [ ] Rate limiting / resource limits on expensive operations
- [ ] Security-relevant events are logged for audit
- [ ] Tests cover authz denials and malicious input, not just happy path

## If you find a vulnerability
Stop and report it clearly (impact, location, reproduction, suggested fix). Don't exploit beyond what's needed to confirm. Don't post sensitive details in public places. Don't silently patch and move on when disclosure or rotation may be required.
