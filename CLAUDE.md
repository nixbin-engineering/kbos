# KBOS — Developer Reference

## What is this?

KBOS is a self-hosted markdown knowledge base app. It is a Next.js frontend served inside Docker, backed by a vault directory on disk. There is also a small Go CLI (`cmd/kb/`) for vault init, user management, encryption, search, and doctor commands.

## Stack

- **Frontend**: Next.js 15 (App Router, TypeScript) in `web/`
- **Backend**: Next.js API routes in `web/app/api/` — no separate Go HTTP server; the Go code is a CLI only
- **Storage**: Plain files on disk; vault directory mounted at `/vault` inside Docker
- **Search**: Bleve (Go, CLI-built index) — the Next.js API wraps it via child-process or pre-built index
- **Auth**: Cookie-based session; users stored in `vault/config/users.yaml`
- **Encryption**: AES-256-GCM envelope; `.md.enc` files for per-file encryption (`internal/crypto/`)

## Key directories

```
web/
  app/api/          API routes (Next.js)
  components/       All React components
  lib/              Shared TS utilities (vault.ts, auth.ts, settings.ts, …)
vault/
  config/
    kb.yaml         Main vault config (name, paths, auth mode, AI, UI)
    users.yaml      User accounts
  docs/             Markdown notes (the actual knowledge base)
  templates/        Note templates
  assets/           Uploaded attachments
internal/           Go packages (CLI only)
  vault/            Vault open/scaffold/config
  crypto/           Encrypt/decrypt helpers (AES-256-GCM)
  auth/             User store helpers
  doc/              Frontmatter + tag parsing
  cli/              Cobra CLI commands
cmd/kb/main.go      Go CLI entry point
scripts/
  init-vault.sh     Runs on `docker compose up` to scaffold vault if missing
```

## Running locally

Always build through Docker — never run npm or Go directly on the host.

```sh
./manage.sh build    # rebuild images
./manage.sh up       # start stack
./manage.sh down     # stop
./manage.sh logs     # follow logs
```

The web container is `kbos`, listens on port 3000 internally. `.env` maps `VAULT_PATH` to the vault directory.

## Vault config (`vault/config/kb.yaml`)

Key fields:
- `vault.name` — display name
- `paths.docs/templates/assets` — subdirectory names within the vault
- `auth.mode` — `public` | `local` (local = login required)
- `ai.enabled/provider/base_url/model` — AI chat config
- `ui.autosave_seconds` — editor autosave interval

## Key components

| Component | Role |
|-----------|------|
| `kbos-shell.tsx` | Top-level app shell; owns all navigation state |
| `doc-workspace.tsx` | Editor + viewer for a single doc |
| `vault-tree.tsx` | Sidebar file tree |
| `search-panel.tsx` | Full-text + fuzzy search |
| `codemirror-editor.tsx` | Markdown editor |
| `ai-chat-panel.tsx` | AI chat sidebar |
| `graph-panel.tsx` | Knowledge graph (D3) |
| `command-palette.tsx` | Ctrl+K command palette |

## API routes (notable)

| Route | Purpose |
|-------|---------|
| `GET /api/tree` | Full vault file tree |
| `GET/PUT/POST/DELETE /api/docs/[...path]` | CRUD for docs |
| `GET/PUT /api/settings` | Read/write kb.yaml settings |
| `POST /api/auth/login` | Login |
| `GET /api/encrypt/unlock` | Unlock session for encrypted docs |
| `GET /api/health` | Health check |
| `POST /api/backup` | Create backup zip |

## Encryption

Per-file encryption: files stored as `.md.enc` on disk. The frontend detects `encrypted: true` in the API response and shows an unlock prompt. Passphrase is kept in an in-memory session map (`lib/crypto-session.ts`).

`EncryptTree` / `DecryptTree` in `internal/crypto/vault.go` can encrypt/decrypt an entire docs tree.

## Navigation model (kbos-shell.tsx)

- `selected` — currently open file path (relative to docs dir)
- `folderView` — if set, show folder index view instead of a doc
- `navHistory` / `navIdx` — back/forward history (ref-based)
- `appView` — `"notes" | "tasks" | "bookmarks"` — top-level view switcher

## Security model

- Login: bcrypt (cost 10) passwords, HMAC-SHA256 session tokens, 14-day expiry
- Cookie: `httpOnly`, `sameSite: strict`, `secure` in production
- Rate limiting: 10 login attempts / 15 min / IP (`lib/rate-limit.ts`)
- CSRF: Origin/Host check on all mutating requests (`lib/require-auth.ts → csrfSafe`)
- Path traversal: `safeDocPath` uses `path.resolve` + prefix check (not regex strip)
- Backup: requires `admin` role
- Encryption sessions: passphrase stored in RAM 30 min TTL (`lib/crypto-session.ts`)
- Password manager: scrypt + AES-256-GCM, secrets never written plaintext to disk

## Multi-vault system

- Registry at `${VAULT_PATH}/registry.yaml` (falls back to single-vault if missing)
- `lib/vault-registry.ts` — load/save registry, ACL helpers
- `lib/vault-session.ts` — per-user active vault (in-memory)
- API: `GET/POST /api/vaults`, `POST /api/vaults/switch`, `GET/PUT/DELETE /api/vaults/[id]`
- ACL fields: `{ user: string, role: "admin"|"editor"|"reader" }[]` per vault entry
- UI: `VaultSwitcher` component in toolbar; Vaults tab in Settings modal

## Password manager

- Entries stored in `${VAULT_PATH}/.kb/passwords/*.pwd.enc` (mode 0600)
- Format: JSON wrapper with plaintext metadata + scrypt+AES-GCM encrypted secrets
- Passphrase = same as vault unlock session (no separate unlock step)
- Shared entries visible to all vault members; private entries visible to owner only
- Features: TOTP generation (client-side, RFC 6238), password generator, clipboard auto-clear (30s)
- API: `GET/POST /api/passwords`, `GET/PUT/DELETE /api/passwords/[id]`
- UI: `PasswordManager` component, accessed via "Passwords" tab in toolbar

## UI components added

| Component | Purpose |
|-----------|---------|
| `tooltip.tsx` | Hover tooltip with configurable side + delay |
| `tab-bar.tsx` | Multi-tab bar with split view toggle |
| `vault-switcher.tsx` | Vault picker dropdown in toolbar |
| `password-manager.tsx` | Full password vault UI with TOTP |

## Adding features checklist

1. API changes → `web/app/api/`
2. Shared TS types → `web/lib/types.ts`
3. Server-side vault helpers → `web/lib/vault.ts`
4. New component → `web/components/`
5. Wire into shell → `web/components/kbos-shell.tsx`
6. Rebuild: `./manage.sh build && ./manage.sh up`
