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

When shipping to production, use this exact sequence:

1. Merge feature work into `main` using the merge strategy above.
2. Wait for that merge commit set to land on remote `main`.
3. On `main`, run `./scripts/update-build-info-from-main.sh` to capture the latest `origin/main` hash and commit timestamp.
4. Commit and push only the metadata change (`build-info.json`) as a separate metadata commit.

Do not include `build-info.json` in feature branch commits unless explicitly requested for non-production testing.
