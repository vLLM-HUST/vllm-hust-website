#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_HOME="${WEBSITE_DEPLOY_HOME:-$REPO_DIR/.website-deploy}"
SYSTEMD_ENV_FILE="${WEBSITE_SYSTEMD_ENV_FILE:-$DEPLOY_HOME/systemd.env}"

if [[ -f "$SYSTEMD_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SYSTEMD_ENV_FILE"
  set +a
fi

if [[ -f "$REPO_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_DIR/.env" 2>/dev/null || true
  set +a
fi

resolve_python_bin() {
  if [[ -n "${WEBSITE_PYTHON_BIN:-}" && -x "${WEBSITE_PYTHON_BIN}" ]]; then
    printf '%s\n' "$WEBSITE_PYTHON_BIN"
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi
  if command -v python >/dev/null 2>&1; then
    command -v python
    return 0
  fi
  return 1
}

main() {
  local python_bin host port root_dir

  python_bin="$(resolve_python_bin)"
  host="${WEBSITE_HOST:-127.0.0.1}"
  port="${WEBSITE_PORT:-8000}"
  root_dir="${WEBSITE_ROOT_DIR:-$REPO_DIR}"

  exec "$python_bin" -m http.server "$port" --bind "$host" --directory "$root_dir"
}

main "$@"