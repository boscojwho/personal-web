# Agent Workflow Policy

This repository uses the following merge rule for all agent-driven pull requests.

## Required Merge Strategy

When merging a feature branch into `main`, preserve the branch's commit history by replaying commits.

Use one of these methods:

1. **Rebase and fast-forward**
   - Rebase the branch onto the latest `main`.
   - Merge with fast-forward so each original commit appears on `main`.
2. **Rebase-and-merge in GitHub**
   - If using GitHub UI/CLI merge options, choose **Rebase and merge**.

Do **not** use squash merge for normal feature branches, because it collapses commit history.

## PR Checklist (Agents)

Before merging a PR, an agent must:

1. Confirm branch is up to date with `main`.
2. Confirm CI/tests pass.
3. Merge by replaying commits (rebase+ff or rebase-and-merge).
4. Verify branch commits are now reachable from `main`.

## Build Metadata (About Hover)

The site reads commit metadata from `build-info.json` (not from client-side GitHub API calls).

Metadata updates must be a **separate post-merge commit** and must not be bundled into feature PR commits.
After any approved PR is merged into `main`, this metadata update is required.

When shipping to production, use this exact sequence:

1. Merge feature work into `main` using the merge strategy above.
2. Wait for that merge commit set to land on remote `main`.
3. On `main`, run `./scripts/update-build-info-from-main.sh` to capture the latest `origin/main` hash and commit timestamp.
4. Create a separate commit directly on `main` that includes only the metadata change (`build-info.json`).
5. The commit message for this metadata commit must be exactly: `Version Bump`.
6. Push that `Version Bump` commit to `origin/main` immediately after the PR merge.

Do not include `build-info.json` in feature branch commits unless explicitly requested for non-production testing.

## Local Route Testing

For local browser testing of this site, use `python3 scripts/serve-local-preview.py`.

Do not use `python3 -m http.server` when testing direct app or writing routes such as `/apps/jot` or `/writing/...`, because static file serving will return a 404 instead of the SPA shell.
