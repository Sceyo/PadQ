# Git & Pull Requests

Applies to commits, branches, history, and PR preparation. History is documentation and a debugging tool. Keep it clean, small, and honest.

## Hard rules
- **Never** force-push, rewrite shared history, reset `--hard`, delete branches/tags you didn't create, or commit to `main`/protected branches without explicit approval.
- **Never** commit secrets, `.env` files, large binaries, build artifacts, or generated files not normally tracked. Check `git status` and `git diff --staged` before every commit.
- **Never** skip hooks (`--no-verify`) or signing to get past a failure. Fix the cause.
- Don't commit or push unless the user asked you to. Preparing changes in the working tree is the default.

## Branches & commits
- Work on a short-lived branch named per project convention (e.g. `feat/…`, `fix/…`, `chore/…`).
- **One logical change per commit;** each commit builds and passes tests where practical. Separate refactor, formatting, dependency, and behavior changes.
- Stage deliberately (`git add -p`); never blindly `git add -A`.
- Commit message: imperative, <=72-char subject; body explains **why** and any non-obvious tradeoffs, not what the diff already shows. Follow the repo's convention (e.g. Conventional Commits) if present.
```
fix(auth): reject expired refresh tokens on rotation

Expired tokens were accepted when the clock skew window overlapped
rotation, allowing reuse for up to 5 minutes. Validate exp before
issuing the new pair. Adds regression test.
```
- Reference issues/tickets. Mark breaking changes clearly.

## Pull requests
Keep them small and reviewable (aim for hundreds of lines, not thousands). Description template:
```
## What & why
Problem, and the approach taken.

## Changes
Key files/areas touched.

## How I verified
Tests run, manual steps, screenshots/logs. What I could NOT verify.

## Risk & rollout
Blast radius, flags, migrations, rollback plan.

## Notes for reviewers
Where to focus; assumptions; follow-ups deliberately left out.
```
- Self-review the diff first (see code-review.md). Link related issues/ADRs.
- Don't mix unrelated changes. Open follow-up issues for out-of-scope findings.

## Conflicts & history
- Prefer rebasing your own unshared branch onto the base; prefer merge for shared branches, per team convention.
- Resolve conflicts by understanding both sides' intent, then re-run tests. Never resolve by blindly taking one side.
- Use `git bisect`, `git blame`, and `git log -S/-G` to understand and debug history.
- To undo a pushed change use `git revert`, not history rewriting.
