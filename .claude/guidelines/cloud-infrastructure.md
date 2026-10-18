# Cloud & Infrastructure

Applies to IaC (Terraform/OpenTofu, Pulumi, CloudFormation/CDK, Bicep), Kubernetes, containers, CI/CD, networking, IAM, and cloud service selection on AWS, GCP, Azure, or hybrid. Infrastructure changes have **large blast radius and real cost**.

## Hard rules
- **Never apply, deploy, or delete** real cloud resources without explicit approval. Run and show `plan`/`diff`/`what-if` output first. Read it; call out destroys, replacements, and IAM/network changes.
- **Never** create long-lived static credentials, public access, or wildcard IAM without explicit justification.
- **Never** put secrets in IaC state, variables files in git, images, or CI logs. Use a secrets manager and workload identity.
- State files are sensitive and shared: use a remote backend with locking and encryption. Never edit state by hand without approval.
- Tag everything (owner, env, cost-center, service) so cost and ownership are traceable.

## Principles (Well-Architected lens)
1. **Operational excellence:** everything as code, small frequent changes, automated rollbacks, runbooks, game days
2. **Security:** least privilege, private by default, encryption, audit logging, defense in depth
3. **Reliability:** eliminate SPOFs, multi-AZ by default for production, tested backups/restore, graceful degradation, health checks, timeouts/retries/backoff
4. **Performance efficiency:** right-sized, autoscaled, use managed services where they fit
5. **Cost optimization:** know the cost drivers; budgets and alerts; shut down idle; commitment discounts after usage stabilizes
6. **Sustainability / simplicity:** fewer moving parts

## IaC practices
- Modules with narrow, documented inputs/outputs; pin provider and module versions.
- Separate state and pipelines per environment/blast-radius boundary (e.g., per account/project + environment).
- Immutable infrastructure; replace rather than patch. Cattle, not pets.
- Idempotent, deterministic code. No manual console changes (or detect and reconcile drift).
- Use policy-as-code (OPA/Conftest, Sentinel, cloud policy) and scanners (tfsec/Checkov/Trivy) in CI.
- Prefer `for_each` over `count` for stable resource addressing. Use lifecycle `prevent_destroy` for stateful critical resources.
- Review plans for **replacement** of databases, volumes, load balancers, or IPs. These cause outages and data loss.

## Compute, containers, Kubernetes
- Containers: minimal base, pinned digests, non-root, read-only rootfs, one process, health/readiness endpoints, graceful `SIGTERM` handling.
- Kubernetes: set resource **requests and limits**; liveness vs readiness vs startup probes used correctly; PodDisruptionBudgets; topology spread; HPA on meaningful metrics; NetworkPolicies; securityContext hardening; namespaces + RBAC least privilege; no `latest` tags.
- Choose the **least operationally heavy** compute that fits: functions/serverless -> managed containers -> Kubernetes -> VMs. Justify moving down the stack.
- Twelve-factor app: config in env, stateless processes, logs to stdout, disposable, dev/prod parity.

## Networking & identity
- Private subnets for workloads and data; public ingress only via load balancer/API gateway/WAF.
- Security groups/firewall rules: specific ports and sources; no `0.0.0.0/0` on admin ports (SSH/RDP/DB).
- Prefer private endpoints/service connect to reach managed services; watch NAT/egress cost.
- Identity: roles and workload identity (IRSA, GKE Workload Identity, managed identities, OIDC for CI) over static keys. Separate accounts/projects per environment.
- DNS/TLS: automated cert issuance/renewal, expiry alerts.

## Data & resilience
- Define RPO/RTO per system. Automated backups, PITR, cross-region copies where required, and **regular restore tests**. Untested backups are hopes.
- Multi-region only when requirements justify the complexity; prefer multi-AZ first. Understand the consistency and failover story before choosing active-active.
- Capacity: quotas/limits known; autoscaling bounds sane; protect downstream dependencies.

## CI/CD
- Pipeline as code; fast feedback; build once, promote the same artifact through environments.
- Progressive delivery: canary/blue-green with automated health gates and one-click rollback.
- Least-privilege deploy identities; protected branches; required reviews; signed artifacts; SBOM.
- Database migrations are a separate, ordered, reversible-aware step (see database.md).

## Cost hygiene
Estimate monthly cost before provisioning anything non-trivial. Call out: data transfer/egress, NAT gateways, idle load balancers, over-provisioned DBs, logging volume, GPU instances, unbounded autoscaling. Add budgets/alerts. Prefer managed services when total cost of ownership (including ops time) is lower.

## Checklist
- [ ] Plan/diff reviewed; no unintended destroys or replacements
- [ ] IAM least privilege; no public exposure without justification
- [ ] Secrets via manager/workload identity
- [ ] Encryption in transit/at rest; logging/audit enabled
- [ ] Backups + tested restore for stateful resources
- [ ] Health checks, autoscaling, and resource limits set
- [ ] Tags, budgets/alerts, and cost estimate present
- [ ] Rollback path defined
