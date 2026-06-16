# KBOS

Local-first knowledge base. **Markdown on disk is the only source of truth.**

## Run (Docker only)

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
