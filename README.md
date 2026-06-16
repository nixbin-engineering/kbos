# KBOS

Local-first knowledge base. **Markdown on disk is the only source of truth.**

## Production — pre-built image

The fastest way to run KBOS. No build step required.

**1. Create your data directories and env file**

```bash
mkdir -p vault vaults
cp .env.example .env
# Edit .env: set DOCKER_UID/DOCKER_GID to match your host user (id -u / id -g)
```

**2. Pull and start**

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**3. Create the first admin user**

```bash
docker compose -f docker-compose.prod.yml exec web \
  kb -V /vault user add admin --admin -p 'changeme'
```

**4. Open the UI**

Navigate to `http://localhost:${KBOS_PORT}` (default `http://localhost:3000`).

**Upgrading**

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Stopping**

```bash
docker compose -f docker-compose.prod.yml down
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

> **Reverse proxy**: If you front KBOS with nginx/Caddy, you can remove the `ports:` block from `docker-compose.prod.yml` and use the `proxy` external network instead.

---

## Local build (from source)

No Go, Node, or other tools on the host — only Docker and `manage.sh`.

```bash
chmod +x manage.sh
./manage.sh setup    # first time: .env, vault/, build, init
./manage.sh start    # start UI in background
./manage.sh build    # after code changes
```

Foreground logs: `./manage.sh up` · Stop: `./manage.sh down` · Help: `./manage.sh --help`

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

Set `VAULT_PATH` or `KBOS_PORT` in `.env` (created by `setup`).

## Architecture

| Service | Role |
|---------|------|
| `init` | One-shot: `kb init`, `kb rebuild` |
| `web` | Next.js UI + interim filesystem API (`/api/*`) |

The web app reads/writes markdown under `/vault/docs`. A **Go HTTP API** will replace these routes later.

## Project layout

```
manage.sh            Docker workflow helper
cmd/kb/              Go CLI
web/                 Next.js UI
vault/               your notes (bind-mounted, gitignored)
product.md           full specification
```

## Design rules

- Authoritative content: `docs/`, `templates/`, `assets/`, `config/` only
- `.kb/` is disposable: `./manage.sh rebuild`
- See [AGENTS.md](AGENTS.md) and [product.md](product.md)
