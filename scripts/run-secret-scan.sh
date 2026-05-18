#!/usr/bin/env bash
set -euo pipefail

GITLEAKS_VERSION="8.24.2"
GITLEAKS_IMAGE="zricethezav/gitleaks:v${GITLEAKS_VERSION}"

run_scan() {
  local scanner="$1"
  echo "[secret-scan] Running gitleaks via ${scanner}"
  "$@"
}

if command -v gitleaks >/dev/null 2>&1; then
  run_scan "local binary" gitleaks dir . --redact -c .gitleaks.toml
  exit 0
fi

if [[ "${GITHUB_ACTIONS:-}" == "true" ]] && command -v docker >/dev/null 2>&1; then
  echo "[secret-scan] Local gitleaks not found; using pinned Docker image ${GITLEAKS_IMAGE}."
  run_scan "docker image" docker run --rm -v "$(pwd):/repo" -w /repo "${GITLEAKS_IMAGE}" dir . --redact -c .gitleaks.toml
  exit 0
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
ARCHIVE="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
URL="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${ARCHIVE}"

if curl -fL --retry 3 --retry-all-errors --connect-timeout 10 "$URL" -o "$TMP_DIR/$ARCHIVE"; then
  tar -xzf "$TMP_DIR/$ARCHIVE" -C "$TMP_DIR"
  chmod +x "$TMP_DIR/gitleaks"
  run_scan "downloaded binary" "$TMP_DIR/gitleaks" dir . --redact -c .gitleaks.toml
  exit 0
fi

echo "[secret-scan] ERROR: Unable to install gitleaks automatically."
echo "[secret-scan] Attempted local binary, pinned Docker image in GitHub Actions, and GitHub release download (${URL})."
echo "[secret-scan] Install gitleaks manually from https://github.com/gitleaks/gitleaks/releases and rerun: npm run security:secrets"
exit 1
