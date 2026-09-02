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

Click the **?** icon in the top-right toolbar for the full getting-started guide,
callout block syntax, and document embed reference — built into KBOS, not part of
your notes.

---

> [!TIP]
> All your notes are stored in the ` + "`docs/`" + ` folder as plain ` + "`.md`" + ` files.
> You can edit them with any text editor, back them up with git, or export them at any time.
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
	"templates/daily/daily.md":     dailyTemplate,
	"templates/weekly/weekly.md":   weeklyTemplate,
	"templates/meeting/meeting.md": meetingTemplate,
	"templates/project/project.md": projectTemplate,
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
