# Claude / Agent Instructions

Follow [AGENTS.md](./AGENTS.md) as the source of truth for repository workflow.

## Merge Rule

For pull requests into `main`, preserve commit history by replaying commits:

- Preferred: rebase branch onto `main` and merge fast-forward.
- Allowed equivalent: GitHub **Rebase and merge**.
- Avoid: squash merges for normal feature branches.
