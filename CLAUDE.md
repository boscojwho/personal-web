# Claude / Agent Instructions

Follow [AGENTS.md](./AGENTS.md) as the source of truth for repository workflow.

## Merge Rule

For pull requests into `main`, preserve commit history by replaying commits:

- Preferred: rebase branch onto `main` and merge fast-forward.
- Allowed equivalent: GitHub **Rebase and merge**.
- Avoid: squash merges for normal feature branches.

## Local Preview

For local browser testing of app and writing routes, use `python3 scripts/serve-local-preview.py`.
Do not use `python3 -m http.server` for route testing because direct requests like `/apps/jot` will 404 instead of serving the SPA shell.
