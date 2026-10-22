# Live session (deferred)

Notes are a markdown file on disk. Open copies update **after a save**, not as someone types. A Google Docs-style live session is deferred. This note is the plan for picking it up later.

## What exists today

- Autosave sends the whole note (`PUT /api/docs/...`) about 300ms after typing pauses.
- `commitDoc` in `web/lib/vault.ts` writes under a per-path lock. If another save landed first, `merge3` (`web/lib/merge3.ts`) keeps both sides. Edits to different lines combine. Edits to the same lines stay in the file between `<<<<<<< local` and `>>>>>>> remote` markers.
- The client sends `expectedMtime` and `baseRaw` (the text it started from) so the server can merge instead of replacing the file.
- Other open copies hear the save through `fs.watch` → SSE (`web/lib/vault-events.ts`, debounced ~400ms), fetch the file, and merge it into the editor if they also have unsaved text.
- Unconfirmed local text is stored in IndexedDB (`drafts` in `web/lib/offline-store.ts`) until the server accepts the write.
- Explicit “Keep my edits” still force-overwrites. Automatic saves do not.

That is save-then-merge. People do not see each other's keystrokes, cursors, or who else has the note open.

## What a later v1 would be

Useful on **one server**, for people who have the note open in KBOS:

- Text updates as others type.
- Each person has a cursor and a name.
- The `.md` file is still the saved copy. The live session flushes to disk about once a second, and on leave.
- Someone not in the session (another device saving the file, an offline draft, Syncthing) still goes through `merge3` into the live copy.

Out of scope for that v1: offline editing inside the live session, cursors across multiple app servers, encrypted notes.

## Why it is not a small add-on

CodeMirror 6 can share an editor (`@codemirror/collab`, or Yjs with a CodeMirror binding). The editor today is the awkward part: `web/components/codemirror-editor.tsx` replaces the whole document when `value` changes. A live session has to own the document and emit small edits. `setRaw(full text)` cannot stay the sync path while a session is open.

The server needs one in-memory session per open note that orders those edits. Next's normal route handlers do not hold that. A WebSocket on this single Docker process is enough for v1. Several app servers would need a shared session store, which is a different project.

The file and the session must have one boss while the note is open:

- Session → disk flush is a snapshot, not a second editor.
- A disk change from outside (watch event whose contents are not the session's last flush) merges into the session.
- Offline drafts and force-save must not write over the session.

Auth stays the existing session cookie. Encrypted notes stay out of the session.

## Rough size

About a focused week for the v1 above. Reconnects, two people opening the same note a moment apart, and an outside file write during a session are the parts that take the time. A full CRDT stored as the vault format is larger and fights “markdown on disk is the source of truth.”
