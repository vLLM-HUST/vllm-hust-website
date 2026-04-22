#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_HOME_DEFAULT="$REPO_DIR/.website-deploy"
SERVICE_NAME_DEFAULT="vllm-hust-website"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SYSTEMD_TEMPLATE="$REPO_DIR/deploy/systemd/vllm-hust-website.service.template"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

deploy_home() {
  printf '%s\n' "${WEBSITE_DEPLOY_HOME:-$DEPLOY_HOME_DEFAULT}"
}

systemd_env_file() {
  printf '%s/systemd.env\n' "$(deploy_home)"
}

service_name() {
  printf '%s\n' "${WEBSITE_SYSTEMD_SERVICE_NAME:-$SERVICE_NAME_DEFAULT}"
}

service_unit_path() {
  printf '%s/%s.service\n' "$SYSTEMD_USER_DIR" "$(service_name)"
}

ensure_systemd_user() {
  if ! systemctl --user show-environment >/dev/null 2>&1; then
    echo "systemd --user is not available for the current user session" >&2
    exit 1
  fi
}

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

write_systemd_env() {
  local python_bin host port root_dir

  python_bin="$(resolve_python_bin || true)"
  host="${WEBSITE_HOST:-127.0.0.1}"
  port="${WEBSITE_PORT:-8000}"
  root_dir="${WEBSITE_ROOT_DIR:-$REPO_DIR}"

  if [[ -z "$python_bin" || ! -x "$python_bin" ]]; then
    echo "Unable to resolve python binary for website service" >&2
    exit 1
  fi

  mkdir -p "$(deploy_home)"
  cat > "$(systemd_env_file)" <<EOF
WEBSITE_DEPLOY_HOME=$(deploy_home)
WEBSITE_PYTHON_BIN=$python_bin
WEBSITE_HOST=$host
WEBSITE_PORT=$port
WEBSITE_ROOT_DIR=$root_dir
EOF
}

install_service_unit() {
  mkdir -p "$SYSTEMD_USER_DIR"
  sed "s|__REPO_DIR__|$REPO_DIR|g" "$SYSTEMD_TEMPLATE" > "$(service_unit_path)"
  systemctl --user daemon-reload
  systemctl --user enable "$(service_name).service" >/dev/null
}

restart_service() {
  systemctl --user restart "$(service_name).service"
}

status_service() {
  systemctl --user --no-pager --full status "$(service_name).service"
}

logs_service() {
  local lines="${1:-120}"
  journalctl --user -u "$(service_name).service" -n "$lines" --no-pager
}

ci_deploy() {
  require_command systemctl
  ensure_systemd_user
  write_systemd_env
  install_service_unit
  restart_service
  sleep 2

  if ! systemctl --user --quiet is-active "$(service_name).service"; then
    echo "systemd website service failed to become active" >&2
    logs_service 160 || true
    exit 1
  fi

  echo "[deploy] website service is active: $(service_name).service"
}

MODE="${1:-ci-deploy}"

case "$MODE" in
  install-service)
    require_command systemctl
    ensure_systemd_user
    write_systemd_env
    install_service_unit
    ;;
  restart)
    require_command systemctl
    ensure_systemd_user
    restart_service
    ;;
  status)
    require_command systemctl
    ensure_systemd_user
    status_service
    ;;
  logs)
    require_command systemctl
    ensure_systemd_user
    logs_service "${2:-120}"
    ;;
  deploy|ci-deploy)
    ci_deploy
    ;;
  *)
    echo "Usage: $0 {install-service|restart|status|logs|deploy|ci-deploy}" >&2
    exit 1
    ;;
esac
