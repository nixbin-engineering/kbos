# KBOS — Agent Guide

Knowledge Base Operating System: local-first, markdown-on-disk, zero vendor lock-in.

## Start here

| Resource | Purpose |
|----------|---------|
| [product.md](product.md) | Full product specification |
| [.cursor/skills/kbos/SKILL.md](.cursor/skills/kbos/SKILL.md) | Build workflow, CLI, gates |
| [.cursor/skills/kbos/reference.md](.cursor/skills/kbos/reference.md) | Phases, layout, API sketch |
| `.cursor/rules/kbos-*.mdc` | Always-on + Go/TS conventions |

## Hard rules

1. Markdown files in the vault are the only source of truth.
2. `.kb/` is disposable — every indexer/cache must be rebuildable.
3. Implement CLI parity for user-facing operations.
4. AI, cloud, and Git are optional add-ons, not dependencies.

## Stack

- **Backend:** Go (`cmd/kb`, `internal/*`)
- **Frontend:** Next.js, TypeScript, Tailwind, shadcn (`web/`)
- **Search:** Bleve (embedded, no external server)

## Run locally

Docker only: `./manage.sh setup` then `./manage.sh up`. Vault bind-mount `./vault` (`VAULT_PATH` in `.env`). No host Go/Node.

## Greenfield order

`docker compose` init → web UI (interim `/api/*` route handlers) → Go REST API → wire UI to API. See [reference.md](.cursor/skills/kbos/reference.md) phases.

When adding a feature, state which phase it belongs to and confirm rebuild/CLI requirements before coding.
