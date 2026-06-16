# KBOS Reference — modules & build phases

## Suggested monorepo layout

```
/data/dockers/web/nt-kb/
├── product.md
├── cmd/kb/                 # CLI
├── internal/               # Go packages (see kbos-go.mdc)
├── api/openapi.yaml        # REST contract (generate or hand-maintain)
├── web/                    # Next.js frontend
├── docs/dev/               # developer docs (encryption format, backup spec)
├── docker-compose.yml
└── vault/                  # example/dev vault (gitignored user data)
```

## Build phases

| Phase | Deliverable | Exit criteria |
|-------|-------------|---------------|
| 0 | `kb init`, vault scaffold | Default tree + `kb.yaml` |
| 1 | Doc parse + file API | Read/write `docs/**/*.md` |
| 2 | Bleve index + `kb rebuild` | `kb search`, advanced filters |
| 3 | Links + backlinks | `[[wikilinks]]`, backlink panel |
| 4 | Web UI core | Tree, editor, search |
| 5 | Templates + variables | `templates/`, `{{date}}` etc. |
| 6 | Transclusion + TOC | `![[embed]]`, heading TOC |
| 7 | Graph views | `kb graph`, UI graph |
| 8 | Tasks + journal | Task dashboard, periodic templates |
| 9 | Attachments CAS | Hash-based `assets/` |
| 10 | Encryption | CLI + API unlock session |
| 11 | Backup | create/restore/verify + destinations |
| 12 | AI + semantic | Provider plug-in, `.kb/vectors/` |
| 13 | Multi-vault, auth, themes | Per-vault settings |
| 14 | Importers/exporters/plugins | Obsidian etc. |

Ship vertically through phases; avoid horizontal "all models, no UI."

## Default `config/kb.yaml` (starter)

```yaml
vault:
  name: default
paths:
  docs: docs
  templates: templates
  assets: assets
index:
  fuzzy: true
auth:
  mode: public  # public | local | proxy
ai:
  enabled: false
  provider: ollama
backup:
  retention_days: 30
```

## Frontmatter schema

```yaml
---
title: string
tags: [string]
aliases: [string]
status: active | archived | draft
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

## Wiki link resolution

1. Exact path `docs/{link}.md`
2. Unique basename across vault
3. `aliases` in frontmatter
4. Unresolved → broken link indicator in UI

## `.kb/` contents (all derived)

| Path | Purpose |
|------|---------|
| `.kb/search/` | Bleve indexes |
| `.kb/vectors/` | Embedding index (optional) |
| `.kb/graph/` | Backlink / relationship cache |
| `.kb/cache/` | Parsed doc cache |
| `.kb/backups/` | Local backup staging |

## REST API (minimum v1)

- `GET /vault/tree` — folder structure
- `GET /docs/{path}` — markdown body + meta
- `PUT /docs/{path}` — write (validates path under docs)
- `GET /search?q=` — Bleve query
- `GET /docs/{path}/backlinks`
- `WS /events` — index rebuild, file change notifications

## Importers (later)

Obsidian, Logseq, Notion export, Joplin, Dendron — map to `docs/` + `assets/`, preserve links where possible.

## Quality bar

Production-ready: Docker, tests (unit + integration + e2e), structured logs, security review for crypto paths, 100k-doc scale tests on indexer.
