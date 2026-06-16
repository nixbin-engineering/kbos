# KBOS UI/UX Roadmap

## Status
- `[ ]` Not started  `[~]` In progress  `[x]` Done

---

## P1
- [x] #21 Command palette (Cmd+K)
- [x] #2 Sidebar layout fix — VaultTree flex-1, search results taller
- [x] #15 Hide .md extension in tree
- [x] #1 Header toolbar declutter — UserMenu dropdown, icon-only Refresh, accent Ask AI
- [x] #4 Empty state / onboarding
- [x] #5 Syntax-highlighted editor — CodeMirror 6

## P2
- [x] #8 Tasks badge when collapsed
- [x] #6 Search result excerpts
- [x] #9 Breadcrumb navigation
- [x] #12 AI chat panel resize — draggable width handle
- [x] #13 Graph panel — force simulation, zoom/pan
- [x] #20 Navigation history — back/forward arrows in header
- [x] #7 Tags panel — remove fixed max-h, let sidebar layout control it
- [x] #11 Disk-conflict diff preview — inline unified diff with keep/reload choice
- [x] #22 Folder note counts in sidebar
- [x] #23 Backlinks panel in doc sidebar
- [x] #24 Encryption fix — auto-navigate after encrypt/decrypt

## P3
- [x] #16 Keyboard shortcuts for view modes (Ctrl+E / Ctrl+\ / Ctrl+Shift+P)
- [x] #14 Save state dot indicator — amber pending, green saved
- [x] #10 Mode toggle labels — text visible beside icons
- [x] #17 Folder icon indicator — filled when index.md present
- [x] #19 Skeleton loading state
- [x] #3 Remove duplicate Ask AI button from doc toolbar
- [x] #25 Templates in command palette (Ctrl+K → "template")
- [x] #26 Backup UI in admin settings — download vault as .tar.gz

## RAG / AI
- [x] Keyword extraction + multi-term search + filesystem fallback
- [x] Vector store — cosine similarity, chunked embeddings, `.kb/vectors/index.json`
- [x] Embedding API (`embedText`, `fetchModels`)
- [x] Index API — streaming full rebuild + incremental per-doc updates
- [x] Model picker with "Fetch" button in admin settings
- [x] Hybrid retrieval — vectors → keywords → filesystem fallback

## Next
- [ ] #27 Ctrl+F find/replace in editor — CodeMirror search panel
- [ ] #28 Note rename / move — context menu + drag-drop
- [ ] #29 Multi-user admin UI — add/remove users, change passwords
- [ ] #30 Wikilink autocomplete — `[[` trigger in CodeMirror
- [ ] #31 Mobile / responsive layout — collapsible sidebar, touch-friendly
- [ ] #32 Note version history — git log per file, restore snapshot
- [ ] #33 Export — single note or folder as PDF / standalone HTML
- [ ] #34 Pinned notes — pin to top of sidebar, persisted in config
