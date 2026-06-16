package vault

import (
	"fmt"
	"os"
	"path/filepath"
)

var scaffoldDirs = []string{
	"docs",
	"docs/projects",
	"docs/research",
	"docs/journal",
	"docs/archive",
	"docs/guide",
	"templates/daily",
	"templates/weekly",
	"templates/project",
	"templates/meeting",
	"assets/images",
	"assets/pdfs",
	"assets/videos",
	"assets/audio",
	"config",
	".kb/search",
	".kb/vectors",
	".kb/graph",
	".kb/cache",
	".kb/backups",
}

const homeMD = `---
title: Home
tags:
  - welcome
  - kbos
status: active
---

# Welcome to KBOS

KBOS is a self-hosted, AI-powered knowledge base for teams and individuals.
Your notes live as plain Markdown files — no lock-in, no cloud dependency.

## Quick start

- **New note** — press ` + "`Ctrl+K`" + ` and choose *New note*, or click **+** in the tab bar
- **Search** — type in the search box on the left, or use ` + "`Ctrl+K`" + ` to open the command palette
- **Tag search** — type ` + "`#docker`" + ` or ` + "`tag:docker`" + ` in the search box
- **AI assistant** — click **Ask AI** in the toolbar or press ` + "`Ctrl+Shift+A`" + `

## Explore the guide

![[guide/getting-started]]

---

> [!TIP]
> All your notes are stored in the ` + "`docs/`" + ` folder as plain ` + "`.md`" + ` files.
> You can edit them with any text editor, back them up with git, or export them at any time.
`

const gettingStartedMD = `---
title: Getting Started
tags:
  - guide
  - kbos
status: active
---

# Getting Started with KBOS

KBOS is built around a single principle: **your knowledge, your files**.
Everything is stored as Markdown on disk. No database, no vendor lock-in.

## Navigation

| Action | How |
|--------|-----|
| Open note | Click in the file tree, or search |
| New note | ` + "`Ctrl+K`" + ` → New note |
| Back / Forward | ` + "`Alt+←`" + ` / ` + "`Alt+→`" + ` |
| Command palette | ` + "`Ctrl+K`" + ` |
| AI assistant | ` + "`Ctrl+Shift+A`" + ` or click **Ask AI** |
| Toggle sidebar | Menu icon in the top-left |

## Writing notes

Notes are standard Markdown with some extras:

### Wikilinks

Link to another note by name:

` + "```" + `
See also [[project-plan]] and [[research/market-analysis]].
` + "```" + `

### Embeds — include another note inline

` + "```" + `
![[getting-started]]
![[meeting-notes#Action items]]
` + "```" + `

The ` + "`![[note]]`" + ` syntax renders the full content of that note inline.
Add a heading anchor (` + "`#Section`" + `) to embed just one section.

### Callout blocks

` + "```" + `
> [!NOTE]
> Something the reader should be aware of.

> [!TIP]
> A helpful suggestion.

> [!WARNING]
> Something that could go wrong.

> [!DANGER]
> A critical warning.

> [!IMPORTANT]
> Key information.
` + "```" + `

> [!NOTE]
> Callout types: NOTE, TIP, WARNING, DANGER, IMPORTANT, INFO, CAUTION

### Task lists

` + "```" + `
- [x] Completed task
- [ ] Pending task
- [ ] Another item
` + "```" + `

### Diagrams (Mermaid)

` + "```" + `
` + "```mermaid" + `
graph LR
  A[Idea] --> B[Note] --> C[Knowledge]
` + "```" + `
` + "```" + `

### Frontmatter

Every note can have YAML frontmatter for metadata:

` + "```yaml" + `
---
title: My Note
tags:
  - project
  - work
status: active
---
` + "```" + `

## Views and modes

### Editor modes

Each note has three view modes (toolbar icons in the note header):

| Icon | Mode |
|------|------|
| ✏️ | Edit only |
| 👁 | Preview only |
| ⬛⬜ | Side-by-side (default) |

### Split view

Click the **⬜⬜** icon in the tab bar to open a second pane.
Enable **Sync scroll** to mirror scrolling between panes.

### Tabs

Open multiple notes in tabs. Right-click a file in the tree to open in a new tab or split.

## Search

The search box supports several query formats:

| Query | Finds |
|-------|-------|
| ` + "`meeting notes`" + ` | Full-text search |
| ` + "`#docker`" + ` or ` + "`tag:docker`" + ` | Notes with that tag |
| ` + "`folder:projects`" + ` | Notes in a folder |

## AI assistant

Click **Ask AI** or press ` + "`Ctrl+Shift+A`" + ` to open the AI chat panel.

The AI has access to your vault content and can:
- Answer questions based on your notes
- Summarize a document or folder
- Suggest related notes
- Help you write or edit content

The scope selector (Vault / Folder / Document) controls how much context the AI sees.

> [!TIP]
> For best results, ask specific questions: *"What did we decide about the API design in the architecture notes?"*

## Password manager

Click **Passwords** in the toolbar (or bottom nav on mobile) to access the built-in password vault.

- Secrets are encrypted with AES-256-GCM
- TOTP (two-factor) codes are generated client-side
- Entries can be private or shared with the team

## Bookmarks

Save external URLs with tags and descriptions. Access via the **Bookmarks** view.

## Tasks

Create and track tasks with priorities, due dates, and team visibility. Access via the **Tasks** view.

## Journal

Click the journal icon (or ` + "`Ctrl+K`" + ` → Journal) to create daily, weekly, or monthly journal entries from templates.

## Knowledge graph

Click the graph icon in the toolbar to visualise how your notes connect through wikilinks.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| ` + "`Ctrl+K`" + ` | Command palette |
| ` + "`Ctrl+Shift+A`" + ` | AI assistant |
| ` + "`Ctrl+S`" + ` | Save note |
| ` + "`Alt+←`" + ` | Navigate back |
| ` + "`Alt+→`" + ` | Navigate forward |
| ` + "`Escape`" + ` | Close panel / clear search |

## Code blocks

Code blocks support syntax highlighting for 50+ languages.
Click the **palette icon** in a code block header to switch themes (VS Code Dark+, Dracula, Night Owl, GitHub, Nord, and more).
Toggle **line numbers** and **word wrap** with the icons in the header.

` + "```typescript" + `
// Example: TypeScript with VS Code Dark+ theme
function greet(name: string): string {
  return ` + "`Hello, ${name}!`" + `;
}
` + "```" + `

## Settings (admin only)

Click your username → Settings to configure:
- Vault name and paths
- Authentication mode (public / local login)
- AI provider (OpenAI-compatible endpoint, model, embedding model)
- UI preferences (autosave interval, theme)
- Multi-vault management

## Multi-vault

KBOS supports multiple vaults. Switch between them using the vault selector in the toolbar.
Each vault has its own notes, config, and ACL (admin / editor / reader roles).

---

> [!TIP]
> Explore the ` + "`guide/`" + ` folder for more detailed documentation on specific features.
`

const featuresCalloutsMD = `---
title: Callout Blocks
tags:
  - guide
  - markdown
status: active
---

# Callout Blocks

Callouts highlight important information inline with your notes.
Use GitHub / Obsidian-style syntax inside a blockquote:

## Syntax

` + "```" + `
> [!TYPE]
> Your message here.
> Can span multiple lines.
` + "```" + `

## Available types

> [!NOTE]
> Use **NOTE** for general information the reader should be aware of.

> [!TIP]
> Use **TIP** for helpful suggestions or pro tips.

> [!WARNING]
> Use **WARNING** for things that could go wrong or require caution.

> [!DANGER]
> Use **DANGER** for critical warnings — data loss, security risks, etc.

> [!IMPORTANT]
> Use **IMPORTANT** for key information that must not be missed.

> [!INFO]
> Use **INFO** for supplementary context or background information.

> [!CAUTION]
> **CAUTION** is an alias for WARNING.
`

const featuresEmbedsMD = `---
title: Document Embeds
tags:
  - guide
  - markdown
  - embeds
status: active
---

# Document Embeds

Embed the content of another note inline using ` + "`![[note-name]]`" + ` syntax.
This is different from a wikilink — the full rendered content appears in place.

## Full note embed

` + "```" + `
![[meeting-notes]]
` + "```" + `

Renders the entire content of ` + "`meeting-notes.md`" + ` at that point in the document.

## Section embed

` + "```" + `
![[meeting-notes#Action items]]
` + "```" + `

Renders only the content under the **Action items** heading in that note.

## Nesting

Embeds render up to 2 levels deep to prevent infinite loops.

## Use cases

- **Home page** — embed summaries from project notes
- **Meeting notes** — embed the relevant spec or design doc
- **Weekly journal** — embed highlights from daily notes
- **Index pages** — embed child documents into a parent overview

> [!TIP]
> Combine embeds with wikilinks: use ` + "`[[note]]`" + ` when you want a clickable link,
> and ` + "`![[note]]`" + ` when you want the full content rendered inline.
`

const dailyTemplate = `---
title: "{{title}}"
tags:
  - journal
  - daily
status: draft
created: {{date}}
updated: {{date}}
---

# Daily — {{date}}

## Focus

-

## Notes

{{cursor}}

## End of day

-
`

const meetingTemplate = `---
title: "{{title}}"
tags:
  - meeting
status: draft
created: {{date}}
updated: {{date}}
---

# {{title}}

**Date:** {{datetime}}

## Attendees

-

## Agenda

-

## Notes

{{cursor}}

## Action items

- [ ]

## Decisions

-
`

const weeklyTemplate = `---
title: "Week {{week}} — {{year}}"
tags:
  - journal
  - weekly
status: draft
created: {{date}}
updated: {{date}}
---

# Week {{week}} — {{year}}

## Highlights

-

## What I learned

-

## Next week

- [ ]

## Notes

{{cursor}}
`

const projectTemplate = `---
title: "{{title}}"
tags:
  - project
status: active
created: {{date}}
updated: {{date}}
---

# {{title}}

## Overview

> One sentence describing what this project is and why it matters.

## Goals

- [ ]

## Status

| Item | Status |
|------|--------|
| Planning | ✅ Done |
| Implementation | 🔄 In progress |
| Review | ⏳ Pending |

## Notes

{{cursor}}

## Links

-
`

var scaffoldFiles = map[string]string{
	"templates/daily/daily.md":         dailyTemplate,
	"templates/weekly/weekly.md":       weeklyTemplate,
	"templates/meeting/meeting.md":     meetingTemplate,
	"templates/project/project.md":     projectTemplate,
	"docs/guide/getting-started.md":    gettingStartedMD,
	"docs/guide/callout-blocks.md":     featuresCalloutsMD,
	"docs/guide/document-embeds.md":    featuresEmbedsMD,
}

// Init creates a new vault at root.
func Init(root string) (*Vault, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return nil, err
	}

	cfg := defaultConfig()
	for _, rel := range scaffoldDirs {
		if err := os.MkdirAll(filepath.Join(abs, rel), 0o755); err != nil {
			return nil, fmt.Errorf("create %s: %w", rel, err)
		}
	}

	homePath := filepath.Join(abs, "docs", "home.md")
	if _, err := os.Stat(homePath); os.IsNotExist(err) {
		if err := os.WriteFile(homePath, []byte(homeMD), 0o644); err != nil {
			return nil, err
		}
	}

	for rel, content := range scaffoldFiles {
		p := filepath.Join(abs, rel)
		if _, err := os.Stat(p); os.IsNotExist(err) {
			if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
				return nil, fmt.Errorf("create %s: %w", rel, err)
			}
		}
	}

	if err := SaveConfig(abs, cfg); err != nil {
		return nil, err
	}

	return &Vault{Root: abs, Config: cfg}, nil
}
