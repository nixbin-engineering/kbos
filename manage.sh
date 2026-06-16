#!/usr/bin/env bash
# KBOS management — Docker-only workflow (no host Go/Node required).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env}"
VAULT_DIR="${VAULT_DIR:-./vault}"

red() { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
bold() { printf '\033[1m%s\033[0m\n' "$*"; }

usage() {
  cat <<'EOF'
KBOS — Knowledge Base Operating System
======================================

Local-first knowledge base. Markdown files on disk are the only source of truth.
Everything runs in Docker — no Go or Node required on the host.

  product.md    Full specification
  README.md     Project overview


QUICK START
-----------

  ./manage.sh setup       First time: .env, vault/, build images, init vault
  ./manage.sh start       Start web UI in background (detached)
  ./manage.sh up          Start web UI in foreground (logs in terminal)
  ./manage.sh open        Print UI URL (default http://localhost:3000)

After changing application code:

  ./manage.sh build       Rebuild Docker images
  ./manage.sh restart     Restart web service


COMMANDS
--------

  setup                   Create .env, vault dir, fix permissions, build, init
  build                   Build/rebuild Docker images (run after code changes)
  up [args]               Start services in foreground (logs attached)
  start [args]            Start services in background (-d)
  down | stop             Stop services
  restart                 Restart web service
  logs                    Follow web logs
  open | url              Print web UI URL
  status                  Compose status + API health check

  init                    kb init + search index rebuild (safe if already init'd)
  rebuild                 Rebuild Bleve search index only (.kb/search/)
  doctor                  Vault health check
  search QUERY            Full-text search (e.g. ./manage.sh search welcome)
  kb ARGS                 Run kb CLI (e.g. ./manage.sh kb -V /vault setup)
                          ./manage.sh kb -V /vault user add alice --admin -p secret
                          ./manage.sh kb -V /vault user list

  fix-perms               chown vault/ to your user (fixes root-owned files)

  help | -h | --help      Show this help


VAULT (bind-mounted host folder)
--------------------------------

Default location: ./vault  (override with VAULT_PATH in .env)

  vault/
  ├── docs/           Your notes (*.md) — edit on host or in the web UI
  ├── templates/      Note templates
  ├── assets/         Images, PDFs, etc.
  ├── config/kb.yaml  Vault configuration
  └── .kb/            Generated indexes (disposable — run ./manage.sh rebuild)

The vault folder is shared with containers. Changes on disk appear in the UI
after refresh. Use ./manage.sh fix-perms if files were created as root.


WEB UI
------

  Vault tree   Hover a folder (or docs root) for + and delete icons
  + menu       New note · New folder · New drawing · New from template
  Notes        Hover a file for delete; click to edit
  Editor       Ctrl/Cmd+S to save · Preview tab for rendered markdown

Search supports filters: tag:docker  folder:linux  title:notes  status:active

Templates live in vault/templates/ (e.g. daily/daily.md). Variables: {{title}}
{{date}} {{datetime}} {{year}} {{month}} {{week}} {{uuid}} {{cursor}}

Inline #tags in markdown (e.g. #docker) merge with frontmatter tags: for search and tag explorer.

FIRST RUN / AUTH
----------------

  Web UI shows a setup wizard when config/users.yaml is missing.
  Create admin account, then sign in.

  CLI alternative:
    ./manage.sh kb -V /vault setup
    ./manage.sh kb -V /vault user add NAME --admin -p PASS
    ./manage.sh kb -V /vault user list
    ./manage.sh kb -V /vault user remove NAME
    ./manage.sh kb -V /vault user passwd NAME


ENVIRONMENT (.env)
------------------

Created by ./manage.sh setup. Safe to edit.

  DOCKER_UID              Host user ID (containers write vault as this user)
  DOCKER_GID              Host group ID
  VAULT_PATH              Host path bind-mounted to /vault (default: ./vault)
  KBOS_PORT               Web UI host port (default: 3000)


EXAMPLES
--------

  ./manage.sh setup
  ./manage.sh up -d
  ./manage.sh build && ./manage.sh restart
  ./manage.sh search tag:welcome
  ./manage.sh kb -V /vault doctor
  VAULT_PATH=/data/notes ./manage.sh setup


ARCHITECTURE
------------

  init service    One-shot: kb init, kb rebuild
  web service     Next.js UI + interim /api/* (reads vault filesystem)

A dedicated Go HTTP API will replace the interim Next.js routes later.
Markdown in vault/ is always authoritative; .kb/ is rebuildable cache.

EOF
}

write_env() {
  local uid gid port vault_path
  uid="$(id -u)"
  gid="$(id -g)"
  port="${KBOS_PORT:-3000}"
  vault_path="${VAULT_PATH:-./vault}"

  if [[ -f "$ENV_FILE" ]]; then
    # Update keys in place if .env exists
    grep -q '^DOCKER_UID=' "$ENV_FILE" 2>/dev/null && sed -i "s/^DOCKER_UID=.*/DOCKER_UID=${uid}/" "$ENV_FILE" \
      || echo "DOCKER_UID=${uid}" >>"$ENV_FILE"
    grep -q '^DOCKER_GID=' "$ENV_FILE" 2>/dev/null && sed -i "s/^DOCKER_GID=.*/DOCKER_GID=${gid}/" "$ENV_FILE" \
      || echo "DOCKER_GID=${gid}" >>"$ENV_FILE"
    grep -q '^KBOS_PORT=' "$ENV_FILE" 2>/dev/null || echo "KBOS_PORT=${port}" >>"$ENV_FILE"
    grep -q '^VAULT_PATH=' "$ENV_FILE" 2>/dev/null || echo "VAULT_PATH=${vault_path}" >>"$ENV_FILE"
  else
    cat >"$ENV_FILE" <<EOF
# Generated by manage.sh setup — safe to edit
DOCKER_UID=${uid}
DOCKER_GID=${gid}
KBOS_PORT=${port}
VAULT_PATH=${vault_path}
EOF
    green "Created ${ENV_FILE}"
  fi
}

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    red "Missing ${ENV_FILE}. Run: ./manage.sh setup"
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  export DOCKER_UID="${DOCKER_UID:-1000}"
  export DOCKER_GID="${DOCKER_GID:-1000}"
  export KBOS_PORT="${KBOS_PORT:-3000}"
  export VAULT_PATH="${VAULT_PATH:-./vault}"
}

ensure_vault_dir() {
  mkdir -p "$VAULT_PATH"
}

fix_perms() {
  ensure_vault_dir
  if [[ -d "$VAULT_PATH" ]]; then
    bold "Fixing ownership of ${VAULT_PATH} → $(id -u):$(id -g)"
    if chown -R "$(id -u):$(id -g)" "$VAULT_PATH" 2>/dev/null; then
      green "Permissions updated."
    else
      sudo chown -R "$(id -u):$(id -g)" "$VAULT_PATH"
      green "Permissions updated (via sudo)."
    fi
  fi
}

dc() {
  load_env
  ensure_vault_dir
  docker compose --env-file "$ENV_FILE" "$@"
}

cmd_setup() {
  bold "KBOS setup"
  write_env
  load_env
  ensure_vault_dir
  fix_perms
  bold "Building images…"
  dc build
  bold "Initializing vault…"
  dc run --rm init
  green "Setup complete."
  green "Start the UI: ./manage.sh start"
  green "URL: http://localhost:${KBOS_PORT}"
}

cmd_up() {
  load_env
  ensure_vault_dir
  fix_perms
  dc up "$@"
}

cmd_start() {
  load_env
  ensure_vault_dir
  fix_perms
  dc up -d "$@"
  green "KBOS running in background."
  green "URL: http://localhost:${KBOS_PORT}"
  green "Logs: ./manage.sh logs"
}

cmd_open() {
  load_env
  echo "http://localhost:${KBOS_PORT}"
}

cmd_status() {
  load_env
  dc ps
  if curl -sf "http://localhost:${KBOS_PORT}/api/health" >/dev/null 2>&1; then
    green "Web API: healthy"
    curl -s "http://localhost:${KBOS_PORT}/api/health"
    echo
  else
    red "Web API: not reachable on port ${KBOS_PORT}"
  fi
}

cmd_kb() {
  load_env
  ensure_vault_dir
  dc run --rm --entrypoint kb "$@"
}

main() {
  # Global help flags (./manage.sh --help, ./manage.sh -h, ./manage.sh)
  if [[ $# -eq 0 ]] || [[ "${1:-}" == "help" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  local cmd="$1"
  shift
  case "$cmd" in
    setup) cmd_setup ;;
    fix-perms) fix_perms ;;
    build) load_env && dc build "$@" ;;
    up) cmd_up "$@" ;;
    start) cmd_start "$@" ;;
    down|stop) load_env && dc down "$@" ;;
    restart) load_env && dc restart web "$@" ;;
    logs) load_env && dc logs -f web "$@" ;;
    open|url) cmd_open ;;
    status) cmd_status ;;
    init) load_env && ensure_vault_dir && fix_perms && dc run --rm init ;;
    rebuild)
      load_env
      dc run --rm --entrypoint kb -V /vault rebuild "$@"
      ;;
    doctor)
      load_env
      dc run --rm --entrypoint kb -V /vault doctor "$@"
      ;;
    search)
      [[ $# -ge 1 ]] || { red "Usage: ./manage.sh search QUERY"; exit 1; }
      load_env
      dc run --rm --entrypoint kb -V /vault search "$@"
      ;;
    kb)
      cmd_kb "$@"
      ;;
    *)
      red "Unknown command: $cmd"
      usage
      exit 1
      ;;
  esac
}

main "$@"
