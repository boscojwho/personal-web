#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="${ROOT_DIR}/build-info.json"

git -C "${ROOT_DIR}" fetch origin main --quiet

COMMIT_HASH="$(git -C "${ROOT_DIR}" rev-parse --short=7 origin/main)"
COMMIT_ISO="$(git -C "${ROOT_DIR}" show -s --format=%cI origin/main)"

cat > "${OUT_FILE}" <<EOF
{
  "commitHash": "${COMMIT_HASH}",
  "commitIso": "${COMMIT_ISO}"
}
EOF

echo "Updated ${OUT_FILE} with origin/main -> ${COMMIT_HASH} (${COMMIT_ISO})"
