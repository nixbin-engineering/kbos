package doc

import "testing"

func TestParseFrontmatter(t *testing.T) {
	raw := `---
title: Docker Notes
tags:
  - docker
status: active
---

# Docker

See [[systemd]] and #linux tag.
`
	d, err := Parse("linux/docker.md", []byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if d.Title != "Docker Notes" {
		t.Fatalf("title: got %q", d.Title)
	}
	if len(d.Tags) != 1 || d.Tags[0] != "docker" {
		t.Fatalf("tags: %v", d.Tags)
	}
	if d.Folder != "linux" {
		t.Fatalf("folder: %q", d.Folder)
	}
	if len(d.WikiLinks) != 1 || d.WikiLinks[0] != "systemd" {
		t.Fatalf("wikilinks: %v", d.WikiLinks)
	}
	if len(d.InlineTags) != 1 || d.InlineTags[0] != "linux" {
		t.Fatalf("inline tags: %v", d.InlineTags)
	}
}

func TestParseScalarTags(t *testing.T) {
	raw := `---
title: Llama
tags: llama
---

# Llama
`
	d, err := Parse("AI/llamacpp/setup.md", []byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Tags) != 1 || d.Tags[0] != "llama" {
		t.Fatalf("tags: %v", d.Tags)
	}
}

func TestParseTemplatePlaceholders(t *testing.T) {
	raw := `---
tags: [project]
created: {{datetime}}
folder: {{folder}}
---

# Project
`
	d, err := Parse("_templates/todo.md.md", []byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Tags) != 1 || d.Tags[0] != "project" {
		t.Fatalf("tags: %v", d.Tags)
	}
}
