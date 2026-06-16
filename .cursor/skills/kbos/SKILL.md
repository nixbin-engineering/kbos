---
name: kbos
description: >-
  Build KBOS (Knowledge Base Operating System) — local-first markdown vault,
  Go backend, Next.js UI, Bleve search, CLI, encryption, backup, optional AI.
  Use when implementing features, scaffolding the repo, designing modules,
  or working on kb/kbos/vault/search/backup/encryption code in this project.
---

# KBOS Build Skill

## Read first

- Constraints: `.cursor/rules/kbos-core.mdc` (always on)
- Full product spec: [product.md](../../../product.md)
- Module map & phases: [reference.md](reference.md)

## Repo bootstrap (greenfield)

Create in order:

1. `go.mod` + `cmd/kb` with `kb init` (scaffold vault dirs + default `config/kb.yaml`)
2. `internal/vault` — resolve vault root, validate layout
3. `internal/doc` — frontmatter + wiki-link parser
4. `internal/index` — Bleve indexer + `kb rebuild`
5. Minimal HTTP API: list tree, read/write doc, search
6. Next.js app: tree + editor + search
7. Docker + docker-compose

Do not add Postgres/SQLite for note bodies. Metadata in Bleve is derived, not authoritative.

## Feature checklist gate

Before marking a feature done:

- [ ] Authoritative data only in `docs/`, `templates/`, `assets/`, `config/`
- [ ] Derived data only in `.kb/` and rebuildable
- [ ] CLI command exists (or extends existing `kb` subcommand)
- [ ] Test covers happy path + rebuild idempotency where indexing involved

## CLI surface (must implement)

```
kb init | rebuild | doctor
kb encrypt | decrypt | lock | unlock | rekey
kb search | graph
kb backup create | restore | verify
kb export | import
```

## Search query grammar

Support combined filters: `tag:docker`, `folder:linux`, `title:networking`, `status:active` plus fuzzy full-text.

## AI (when requested)

- Provider interface; no hard-coded vendor
- RAG retrieves from markdown files only
- Every response includes document citations
- Vectors under `.kb/vectors/`; rebuildable

## Encryption

- Per-doc and per-folder; format `*.md.enc`; AES-256-GCM + Argon2id
- Document format in-repo; decrypt via CLI without UI

## Plugins

Hook points: search, AI, rendering, backup destinations, importers/exporters. REST + WebSocket documented alongside core API.

## When stuck

1. Re-read non-negotiables in `product.md` § Non-Negotiable Architectural Constraints
2. Prefer `kb rebuild` over patching `.kb/` by hand
3. Split large PRs: vault I/O → index → API → UI
