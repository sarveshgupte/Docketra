#!/usr/bin/env bash
set -euo pipefail

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks dir . --redact -c .gitleaks.toml
  exit 0
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
VERSION="8.24.2"
ARCHIVE="gitleaks_${VERSION}_linux_x64.tar.gz"
URL="https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/${ARCHIVE}"

curl -fsSL "$URL" -o "$TMP_DIR/$ARCHIVE"
tar -xzf "$TMP_DIR/$ARCHIVE" -C "$TMP_DIR"
"$TMP_DIR/gitleaks" dir . --redact -c .gitleaks.toml
