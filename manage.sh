#!/usr/bin/env bash
# KBOS management — Docker-only workflow (no host Go/Node required).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env}"
VAULT_DIR="${VAULT_DIR:-./vault}"
IMAGE_REPO="${IMAGE_REPO:-ghcr.io/nixbin-engineering/kbos}"
# Production (default) pulls a pre-built image; --dev builds from source.
COMPOSE_PROD="${COMPOSE_PROD:-docker-compose.yml}"
COMPOSE_DEV="${COMPOSE_DEV:-docker-compose.dev.yml}"

red() { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
bold() { printf '\033[1m%s\033[0m\n' "$*"; }

# --dev / --prod pick the compose file. Default is production.
# docker:build / docker:push keep --prod (release-tier guard); it is not stripped.
USE_DEV=false
_FLAG_COMPOSE=""
_REMAINING_ARGS=()
case "${1:-}" in
  docker:build|docker:push) _PRESERVE_TIER_FLAGS=true ;;
  *)                        _PRESERVE_TIER_FLAGS=false ;;
esac
for _arg in "$@"; do
  case "$_arg" in
    --dev)
      USE_DEV=true
      _FLAG_COMPOSE="$COMPOSE_DEV"
      if $_PRESERVE_TIER_FLAGS; then _REMAINING_ARGS+=("$_arg"); fi
      ;;
    --prod)
      USE_DEV=false
      _FLAG_COMPOSE="$COMPOSE_PROD"
      if $_PRESERVE_TIER_FLAGS; then _REMAINING_ARGS+=("$_arg"); fi
      ;;
    *) _REMAINING_ARGS+=("$_arg") ;;
  esac
done
set -- "${_REMAINING_ARGS[@]+"${_REMAINING_ARGS[@]}"}"
unset _REMAINING_ARGS _arg _PRESERVE_TIER_FLAGS

# Resolved after load_env so --dev/--prod win over COMPOSE_FILE in .env.
resolve_compose_file() {
  if [[ -n "$_FLAG_COMPOSE" ]]; then
    COMPOSE_FILE="$_FLAG_COMPOSE"
  elif [[ -z "${COMPOSE_FILE:-}" ]]; then
    COMPOSE_FILE="$COMPOSE_PROD"
  fi
}

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

  Production (default — pulls ghcr.io image):

  ./manage.sh start                 Start web UI in background
  ./manage.sh up                    Foreground (logs attached)
  ./manage.sh deploy:release        On the server: git pull, image pull, up -d

  Local / from source (--dev — builds images):

  ./manage.sh setup --dev           First time: .env, vault/, build, init
  ./manage.sh up --dev              Bring up the dev stack
  ./manage.sh build --dev           Rebuild after code changes
  ./manage.sh restart --dev         Recreate web with newly built image

  ./manage.sh open                  Print UI URL (default http://localhost:3000)


COMMANDS
--------

  --dev / --prod          Global: pick docker-compose.dev.yml or docker-compose.yml
                          (default: production / docker-compose.yml)

  setup                   Create .env, vault dir, fix permissions, build, init
                          (requires --dev — builds from source)
  build                   Build/rebuild Docker images (requires --dev)
  up [args]               Start services in foreground (logs attached)
  start [args]            Start services in background (-d)
  down | stop             Stop services
  restart                 Restart web service
  logs                    Follow web logs
  shell                   Open a shell in the web container
  open | url              Print web UI URL
  status                  Compose status + API health check

  init                    kb init + search index rebuild (safe if already init'd)
  rebuild                 Rebuild Bleve search index only (.kb/search/)
  doctor                  Vault health check
  search QUERY            Full-text search (e.g. ./manage.sh search welcome)
  kb ARGS                 Run kb CLI (e.g. ./manage.sh kb -V /vault setup)
                          ./manage.sh kb -V /vault user add alice --admin -p secret
                          ./manage.sh kb -V /vault user list

  user:list               List local users (username, role, created)
  user:search QUERY       Search local users by username substring
  user:show USERNAME      Show one user's details
  user:password USERNAME [-p PASS]   Reset a user's password (prompts if omitted)
  user:promote USERNAME   Grant admin role
  user:demote USERNAME    Remove admin role (back to plain user)

  fix-perms               chown vault/ to your user (fixes root-owned files)

  docker:version          Show current release tag (git) and what --patch/--minor/--major would produce
  docker:build --prod [--major|--minor|--patch|-t TAG]
                          Build image from web/Dockerfile, tagged $IMAGE_REPO:TAG + :latest
                          (no bump/-t: reuses current release tag; does not push or tag git)
  docker:push --prod [--major|--minor|--patch|-t TAG]
                          Smoke-test the running stack, then build + push
                          $IMAGE_REPO:TAG and :latest
                          (--major/--minor/--patch also creates and pushes a git release tag)
  secrets:rotate [KEY ...]
                          Rotate secret-like keys in .env (or only the ones named)
                          Backs up .env first; does not restart anything
  deploy:release          On the prod server: git pull --ff-only, pull $IMAGE_REPO:latest,
                          then up -d (always uses production compose)

  sync:up                 Start optional Syncthing sibling (docker-compose.sync.yml)
  sync:down               Stop Syncthing only (KBOS keeps running)
                          See docs/vault-sync.md for laptop↔server vault sync

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

Created by ./manage.sh setup --dev. Safe to edit.

  DOCKER_UID              Host user ID (containers write vault as this user)
  DOCKER_GID              Host group ID
  VAULT_PATH              Host path bind-mounted to /vault (default: ./vault)
  KBOS_PORT               Web UI host port (default: 3000)
  COMPOSE_FILE            Optional override (else --dev → docker-compose.dev.yml,
                          default → docker-compose.yml)


EXAMPLES
--------

  ./manage.sh start
  ./manage.sh up --dev
  ./manage.sh setup --dev
  ./manage.sh build --dev && ./manage.sh restart --dev
  ./manage.sh search tag:welcome
  ./manage.sh kb -V /vault doctor
  VAULT_PATH=/data/notes ./manage.sh setup --dev

  ./manage.sh docker:version
  ./manage.sh docker:build --prod --patch
  ./manage.sh docker:push --prod --minor
  ./manage.sh deploy:release   # run on the prod server
  ./manage.sh sync:up          # optional Syncthing for laptop↔server vault sync


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
    red "Missing ${ENV_FILE}. Run: ./manage.sh setup --dev"
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
  resolve_compose_file
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
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# setup / build only make sense against the source-build compose.
require_dev_compose() {
  resolve_compose_file
  if [[ "$COMPOSE_FILE" != "$COMPOSE_DEV" ]]; then
    red "This command builds from source — pass --dev (uses ${COMPOSE_DEV})."
    red "Example: ./manage.sh $1 --dev"
    exit 1
  fi
}

cmd_setup() {
  require_dev_compose setup
  bold "KBOS setup (${COMPOSE_FILE})"
  write_env
  load_env
  ensure_vault_dir
  fix_perms
  bold "Building images…"
  dc build
  bold "Initializing vault…"
  dc run --rm init
  green "Setup complete."
  green "Start the UI: ./manage.sh start --dev"
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
  dc run --rm --entrypoint kb init "$@"
}

cmd_user() {
  load_env
  ensure_vault_dir
  dc run --rm --entrypoint kb init -V /vault user "$@"
}

cmd_shell() {
  load_env
  dc exec web sh "$@"
}

# Release versioning is tracked as git tags (vMAJOR.MINOR.PATCH), not a file —
# the tag *is* the record of what was released, and it travels with the repo.
current_release_version() {
  git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | sed -n '1p'
}

next_release_version() {
  local bump="$1" latest raw major minor patch
  latest="$(current_release_version)"
  if [[ -z "$latest" ]]; then
    case "$bump" in
      major) echo "v1.0.0" ;;
      minor) echo "v0.1.0" ;;
      patch) echo "v0.0.1" ;;
      *) red "Unknown bump: $bump"; exit 1 ;;
    esac
    return 0
  fi
  raw="${latest#v}"
  IFS='.' read -r major minor patch <<<"$raw"
  case "$bump" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
    *) red "Unknown bump: $bump"; exit 1 ;;
  esac
  echo "v${major}.${minor}.${patch}"
}

cmd_docker_version() {
  local current
  current="$(current_release_version)"
  if [[ -z "$current" ]]; then
    bold "No release tags found."
  else
    green "Current release : $current"
  fi
  bold "Next --patch    : $(next_release_version patch)"
  bold "Next --minor    : $(next_release_version minor)"
  bold "Next --major    : $(next_release_version major)"
}

# Parses --major/--minor/--patch/-t TAG (mutually exclusive) into $TAG_ARG,
# falling back to the current release tag when none is given.
resolve_release_tag() {
  local bump="" tag="" next_is_tag=false a
  for a in "$@"; do
    if $next_is_tag; then tag="$a"; next_is_tag=false; continue; fi
    case "$a" in
      --major) bump=major ;;
      --minor) bump=minor ;;
      --patch) bump=patch ;;
      -t|--tag) next_is_tag=true ;;
      --prod) ;;
      *) red "Unknown flag: $a"; exit 1 ;;
    esac
  done
  if [[ -n "$tag" && -n "$bump" ]]; then
    red "Use either -t/--tag or --major/--minor/--patch, not both."
    exit 1
  fi
  if [[ -n "$bump" ]]; then
    TAG_ARG="$(next_release_version "$bump")"
    BUMP_KIND="$bump"
  elif [[ -n "$tag" ]]; then
    TAG_ARG="$tag"
    BUMP_KIND=""
  else
    TAG_ARG="$(current_release_version)"
    BUMP_KIND=""
    [[ -n "$TAG_ARG" ]] || { red "No release tag found — pass --major/--minor/--patch or -t TAG."; exit 1; }
  fi
}

cmd_docker_build() {
  [[ " $* " == *" --prod "* ]] || { red "Usage: ./manage.sh docker:build --prod [--major|--minor|--patch|-t TAG]"; exit 1; }
  local TAG_ARG BUMP_KIND
  resolve_release_tag "$@"
  bold "Building ${IMAGE_REPO}:${TAG_ARG} (+ :latest) from web/Dockerfile"
  docker build -f web/Dockerfile -t "${IMAGE_REPO}:${TAG_ARG}" -t "${IMAGE_REPO}:latest" .
  green "Built ${IMAGE_REPO}:${TAG_ARG} and ${IMAGE_REPO}:latest"
}

# Smoke test gate for docker:push — blocks the release if the running stack's
# health endpoint isn't reachable/healthy. Doesn't build anything itself.
cmd_smoke_test() {
  load_env
  bold "Smoke test: checking web container's /api/health…"
  if docker exec kbos node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    green "Smoke test passed: API is healthy."
  else
    red "Smoke test FAILED: kbos container's /api/health is not reachable/healthy."
    red "Start the stack first (./manage.sh start) and verify it's healthy, then retry."
    exit 1
  fi
}

cmd_docker_push() {
  [[ " $* " == *" --prod "* ]] || { red "Usage: ./manage.sh docker:push --prod [--major|--minor|--patch|-t TAG]"; exit 1; }
  local TAG_ARG BUMP_KIND
  resolve_release_tag "$@"
  cmd_smoke_test
  cmd_docker_build --prod -t "$TAG_ARG"
  bold "Pushing ${IMAGE_REPO}:${TAG_ARG} and ${IMAGE_REPO}:latest"
  docker push "${IMAGE_REPO}:${TAG_ARG}"
  docker push "${IMAGE_REPO}:latest"
  green "Pushed ${IMAGE_REPO}:${TAG_ARG} (and :latest)"
  if [[ -n "$BUMP_KIND" ]]; then
    bold "Tagging release ${TAG_ARG} in git"
    git tag -a "$TAG_ARG" -m "Release $TAG_ARG"
    git push origin "$TAG_ARG"
    green "Pushed git tag $TAG_ARG"
  fi
}

cmd_secrets_rotate() {
  load_env
  local keys=() k backup
  if [[ $# -gt 0 ]]; then
    keys=("$@")
  else
    while IFS='=' read -r k _; do
      [[ "$k" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
      shopt -s nocasematch
      if [[ "$k" =~ (_SECRET|_PASSWORD|_KEY|_TOKEN|_PASS|^JWT_) ]]; then
        keys+=("$k")
      fi
      shopt -u nocasematch
    done <"$ENV_FILE"
  fi

  if [[ "${#keys[@]}" -eq 0 ]]; then
    bold "No secret-like keys found in ${ENV_FILE} (looked for *_SECRET/*_PASSWORD/*_KEY/*_TOKEN/*_PASS/JWT_*)."
    exit 0
  fi

  bold "About to rotate ${#keys[@]} key(s) in ${ENV_FILE}:"
  printf '  %s\n' "${keys[@]}"
  read -r -p "Continue? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { red "Aborted."; exit 1; }

  backup="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  cp "$ENV_FILE" "$backup"
  green "Backed up ${ENV_FILE} → ${backup}"

  for k in "${keys[@]}"; do
    if ! grep -q "^${k}=" "$ENV_FILE"; then
      red "Skipping ${k}: not found in ${ENV_FILE}"
      continue
    fi
    local new_val tmp
    new_val="$(openssl rand -base64 32 | tr -d '\n')"
    tmp="$(mktemp)"
    awk -v key="$k" -v val="$new_val" -F= 'BEGIN{OFS="="} $1==key{$0=key"="val} {print}' "$ENV_FILE" >"$tmp"
    mv "$tmp" "$ENV_FILE"
    green "Rotated ${k}"
  done

  bold "Done. This only rewrote ${ENV_FILE} — it did not restart anything and did not"
  bold "rotate credentials on any external system these values correspond to."
  bold "Run ./manage.sh restart (or deploy:release on the server) to apply the new values."
}

# Production release deploy: always pull the published image (never build).
cmd_deploy_release() {
  USE_DEV=false
  _FLAG_COMPOSE="$COMPOSE_PROD"
  COMPOSE_FILE="$COMPOSE_PROD"
  bold "Deploying latest release (${COMPOSE_FILE} — pull image, do not build)"
  if [[ -d .git ]]; then
    bold "Pulling latest repo changes…"
    git pull --ff-only
  fi
  load_env
  ensure_vault_dir
  bold "Pulling ${IMAGE_REPO}:latest…"
  dc pull
  bold "Starting services…"
  dc up -d
  green "Deployed. URL: http://localhost:${KBOS_PORT}"
  dc ps
}

cmd_sync_up() {
  load_env
  ensure_vault_dir
  local cfg="${SYNCTHING_CONFIG:-./.syncthing}"
  mkdir -p "$cfg"
  if [[ -f vault/.stignore.example && ! -f "${VAULT_PATH}/.stignore" ]]; then
    cp vault/.stignore.example "${VAULT_PATH}/.stignore"
    green "Installed ${VAULT_PATH}/.stignore from vault/.stignore.example"
  fi
  bold "Starting Syncthing sibling (shares VAULT_PATH=${VAULT_PATH})…"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -f docker-compose.sync.yml up -d syncthing
  green "Syncthing UI: http://localhost:${SYNCTHING_UI_PORT:-8384}"
  bold "In the UI, add shared folder path /vault and pair the other host. See docs/vault-sync.md"
}

cmd_sync_down() {
  load_env
  bold "Stopping Syncthing sibling (KBOS unchanged)…"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -f docker-compose.sync.yml stop syncthing "$@" || true
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -f docker-compose.sync.yml rm -f syncthing "$@" || true
  green "Syncthing stopped."
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
    build) require_dev_compose build; load_env && dc build "$@" ;;
    up) cmd_up "$@" ;;
    start) cmd_start "$@" ;;
    down|stop) load_env && dc down "$@" ;;
    restart) load_env && dc up -d --force-recreate --no-deps web "$@" ;;
    logs) load_env && dc logs -f web "$@" ;;
    shell) cmd_shell "$@" ;;
    open|url) cmd_open ;;
    status) cmd_status ;;
    init) load_env && ensure_vault_dir && fix_perms && dc run --rm init ;;
    rebuild)
      load_env
      dc run --rm --entrypoint kb init -V /vault rebuild "$@"
      ;;
    doctor)
      load_env
      dc run --rm --entrypoint kb init -V /vault doctor "$@"
      ;;
    search)
      [[ $# -ge 1 ]] || { red "Usage: ./manage.sh search QUERY"; exit 1; }
      load_env
      dc run --rm --entrypoint kb init -V /vault search "$@"
      ;;
    kb)
      cmd_kb "$@"
      ;;
    user:list)     cmd_user list ;;
    user:search)
      [[ $# -ge 1 ]] || { red "Usage: ./manage.sh user:search QUERY"; exit 1; }
      cmd_user search "$@"
      ;;
    user:show)
      [[ $# -ge 1 ]] || { red "Usage: ./manage.sh user:show USERNAME"; exit 1; }
      cmd_user show "$@"
      ;;
    user:password)
      [[ $# -ge 1 ]] || { red "Usage: ./manage.sh user:password USERNAME [-p PASSWORD]"; exit 1; }
      cmd_user passwd "$@"
      ;;
    user:promote)
      [[ $# -ge 1 ]] || { red "Usage: ./manage.sh user:promote USERNAME"; exit 1; }
      cmd_user promote "$@"
      ;;
    user:demote)
      [[ $# -ge 1 ]] || { red "Usage: ./manage.sh user:demote USERNAME"; exit 1; }
      cmd_user demote "$@"
      ;;
    docker:version) cmd_docker_version ;;
    docker:build)   cmd_docker_build "$@" ;;
    docker:push)    cmd_docker_push "$@" ;;
    secrets:rotate) cmd_secrets_rotate "$@" ;;
    deploy:release) cmd_deploy_release ;;
    sync:up) cmd_sync_up ;;
    sync:down) cmd_sync_down "$@" ;;
    *)
      red "Unknown command: $cmd"
      usage
      exit 1
      ;;
  esac
}

main "$@"
