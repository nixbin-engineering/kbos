# KBOS

Local-first knowledge base. **Markdown on disk is the only source of truth.**

## Production — pre-built image (default)

`docker-compose.yml` pulls `ghcr.io/nixbin-engineering/kbos:latest`. No build step.

**1. Create your data directories and env file**

```bash
mkdir -p vault vaults
cp .env.example .env
# Edit .env: set DOCKER_UID/DOCKER_GID to match your host user (id -u / id -g)
```

**2. Pull and start**

```bash
./manage.sh deploy:release   # preferred on the server (git pull + image pull + up -d)
# or:
./manage.sh start
```

**3. Create the first admin user**

```bash
./manage.sh kb -V /vault user add admin --admin -p 'changeme'
```

**4. Open the UI**

Navigate to `http://localhost:${KBOS_PORT}` (default `http://localhost:3000`).

**Stopping**

```bash
./manage.sh down
```

### .env settings

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKER_UID` | `1000` | UID that owns vault files — should match your host user (`id -u`) |
| `DOCKER_GID` | `1000` | GID that owns vault files — should match your host group (`id -g`) |
| `VAULT_PATH` | `./vault` | Path to your primary vault directory on the host |
| `VAULTS_BASE` | `./vaults` | Path to the multi-vault base directory on the host |
| `KBOS_PORT` | `3000` | Host port the web UI is exposed on |

> **Reverse proxy**: If you front KBOS with nginx/Caddy, you can remove the `ports:` block from `docker-compose.yml` and use the `proxy` external network instead.

---

## Local build (from source)

Uses `docker-compose.dev.yml` via `--dev`. No Go/Node on the host — only Docker and `manage.sh`.

```bash
chmod +x manage.sh
./manage.sh setup --dev    # first time: .env, vault/, build, init
./manage.sh up --dev       # foreground
./manage.sh start --dev    # background
./manage.sh build --dev    # after code changes
./manage.sh restart --dev
```

Notes live in **`./vault/docs/`** (bind-mounted). Edit on the host or use the web UI (**New note** / **New folder** in the sidebar).

### manage.sh

```bash
./manage.sh help
./manage.sh fix-perms     # fix root-owned files in vault/
./manage.sh init          # vault init + index rebuild
./manage.sh rebuild       # index only
./manage.sh search welcome
./manage.sh doctor
./manage.sh kb -V /vault search tag:docker
```

Set `VAULT_PATH` or `KBOS_PORT` in `.env` (created by `setup --dev`).

## Multi-instance sync (laptop ↔ server)

KBOS does not sync containers to each other. Sync the **vault bind-mount** with Syncthing (or git). Runbook: [docs/vault-sync.md](docs/vault-sync.md). Optional Syncthing sidecar: `./manage.sh sync:up`.

## Architecture

| Service | Role |
|---------|------|
| `init` | One-shot: `kb init`, `kb rebuild` |
| `web` | Next.js UI + interim filesystem API (`/api/*`) |
| `syncthing` (optional) | Sibling container sharing `VAULT_PATH` — see `docker-compose.sync.yml` |

The web app reads/writes markdown under `/vault/docs`. A **Go HTTP API** will replace these routes later.

## Project layout

```
manage.sh               Docker workflow helper
cmd/kb/                 Go CLI
web/                    Next.js UI
vault/                  your notes (bind-mounted, gitignored)
docs/vault-sync.md      laptop↔server vault sync runbook
docker-compose.yml      production (default) — pull ghcr image
docker-compose.dev.yml  local — build from source (--dev)
docker-compose.sync.yml optional Syncthing sibling
```

## Design rules

- Authoritative content: `docs/`, `templates/`, `assets/`, `config/` only
- `.kb/` is disposable: `./manage.sh rebuild`
- See [AGENTS.md](AGENTS.md) and [product.md](product.md)
