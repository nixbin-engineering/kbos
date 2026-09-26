# Your KBOS vault

This folder is **bind-mounted** into Docker at `/vault`. Edit markdown here with any editor; the web UI reads the same files.

On first `./manage.sh setup` (or `up`), the `init` service creates:

```
vault/
├── docs/           # your notes (*.md)
├── templates/
├── assets/
├── config/kb.yaml
└── .kb/            # generated indexes (safe to delete; run init/rebuild)
```

To use a different host path:

```bash
# set VAULT_PATH in .env, then:
./manage.sh up
```

## Syncing with another KBOS host

The vault is plain files on disk — sync `VAULT_PATH` between laptop and server with Syncthing (recommended) or git. See [docs/vault-sync.md](../docs/vault-sync.md). Ignore template: [`.stignore.example`](./.stignore.example).
