# Multi-instance vault sync (laptop ↔ server)

KBOS does **not** replicate between instances over HTTPS. Each host runs its own Docker container; notes live in a host directory bind-mounted at `/vault` (`VAULT_PATH`, usually `./vault`). To keep two machines in sync, sync **that directory on the host** (or via a sibling Syncthing container). The UI already refreshes when files change on disk (`fs.watch` → SSE).

```
Laptop KBOS ──bind──► ./vault  ◄──Syncthing──►  ./vault  ◄──bind── Server KBOS
```

## Recommended approach

| Layer | Choice |
|-------|--------|
| Live bidirectional sync | **Syncthing** on the vault path |
| Optional history | **Git** inside the vault (checkpoints / note history UI) — not the day-to-day sync plane |
| Native KBOS↔KBOS API | **Deferred** — only revisit if Syncthing is insufficient |

## What to sync

**Include**

- `docs/` — notes (source of truth)
- `templates/`
- `assets/`

**Decide carefully: `config/`**

Syncing `config/` shares users, groups, AI settings, and vault config. That only works if both instances should share the same identity store (including `session_secret` / `users.yaml`). Prefer **same config** for a personal laptop+server pair; keep config **local** if the server has different users or public exposure.

**Exclude**

- `.kb/` — search / vector caches (disposable). Rebuild after a large sync if search feels stale:
  ```bash
  ./manage.sh rebuild
  ```
- Syncthing’s own state under the config volume (never put that inside the vault)

**Encrypted notes & passwords**

- `.md.enc` files under `docs/` sync like any other file if `docs/` is shared — passphrase stays off-disk as today.
- Password manager data under `.kb/passwords/` is **not** synced if `.kb/` is ignored. If you need it on both machines, either sync a dedicated path or keep passwords on one host only.

## Option A — Syncthing on the host

1. Install Syncthing on laptop and server.
2. Share the same folder as `VAULT_PATH` on each host (e.g. `/Volumes/.../kbos/vault` and `/data/kbos/vault`).
3. Copy the ignore template into the vault (once per side, or let Syncthing propagate it):
   ```bash
   cp vault/.stignore.example vault/.stignore
   ```
4. Pair the devices; set folder type to **Send & Receive**.
5. Keep KBOS running as usual (`./manage.sh start` / compose). No app rebuild required.

## Option B — Syncthing sibling container

Use the optional compose overlay so Syncthing shares the vault bind-mount with KBOS:

```bash
# Dev / local compose
docker compose --env-file .env -f docker-compose.yml -f docker-compose.sync.yml up -d

# Or via manage.sh
./manage.sh sync:up
```

- Syncthing UI: `http://localhost:${SYNCTHING_UI_PORT:-8384}` (set in `.env` if needed).
- In the UI, add folder path **`/vault`** (already mounted), apply the same ignore rules as `.stignore.example`, and pair with the other host.
- Stop only Syncthing: `./manage.sh sync:down` (leaves KBOS running).

See [`docker-compose.sync.yml`](../docker-compose.sync.yml) and [`.env.example`](../.env.example).

## Ops caveats

- **Concurrent edits** on the same file = last-write-wins until a future conflict UI exists. Prefer editing on one machine at a time when possible.
- **UID/GID**: set `DOCKER_UID` / `DOCKER_GID` to the host user that owns the vault so both KBOS and Syncthing write compatible ownership.
- **Multi-vault (`VAULTS_BASE`)**: this runbook targets the primary `VAULT_PATH`. Extra vaults under `./vaults` need their own Syncthing folders if you use them.
- After bulk sync, if tags/search lag: `./manage.sh rebuild`.

## Deferred (not planned until Syncthing proves insufficient)

- In-app “Sync now” / push-pull between KBOS instances
- Conflict resolution UI or CRDT merging
- Syncing container images or `.kb` caches as source of truth
