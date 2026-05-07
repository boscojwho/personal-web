#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require_clean_tree() {
  local status
  status="$(git -C "${ROOT_DIR}" status --porcelain)"
  if [[ -n "${status}" ]]; then
    echo "Refusing to run: working tree is not clean." >&2
    echo "${status}" >&2
    exit 1
  fi
}

require_on_main() {
  local branch
  branch="$(git -C "${ROOT_DIR}" branch --show-current)"
  if [[ "${branch}" != "main" ]]; then
    echo "Refusing to run: current branch is '${branch}', expected 'main'." >&2
    exit 1
  fi
}

require_clean_tree
require_on_main

"${ROOT_DIR}/scripts/update-build-info-from-main.sh"

changed_files="$(git -C "${ROOT_DIR}" diff --name-only)"
if [[ "${changed_files}" != "build-info.json" ]]; then
  echo "Refusing to continue: expected only build-info.json to change." >&2
  printf '%s\n' "${changed_files}" >&2
  exit 1
fi

git -C "${ROOT_DIR}" add build-info.json
git -C "${ROOT_DIR}" commit -m "Version Bump"
git -C "${ROOT_DIR}" push origin main

version_bump_sha="$(git -C "${ROOT_DIR}" rev-parse --short=7 HEAD)"
echo "Created and pushed Version Bump commit ${version_bump_sha}"
