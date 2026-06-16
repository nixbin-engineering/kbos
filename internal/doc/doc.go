package doc

import (
	"bufio"
	"fmt"
	"path/filepath"
	"strings"
)

// Meta is YAML frontmatter metadata.
type Meta struct {
	Title   string   `yaml:"title"`
	Tags    []string `yaml:"tags"`
	Aliases []string `yaml:"aliases"`
	Status  string   `yaml:"status"`
	Created string   `yaml:"created"`
	Updated string   `yaml:"updated"`
}

// Document is a parsed markdown file.
type Document struct {
	Path        string // relative to docs dir, e.g. projects/foo.md
	Folder      string // parent folder relative to docs
	Title       string
	Body        string
	Tags        []string
	Aliases     []string
	Status      string
	InlineTags  []string // #tags in body
	WikiLinks   []string
}

// Parse reads frontmatter and body from raw markdown bytes.
func Parse(path string, data []byte) (*Document, error) {
	meta, body, err := splitFrontmatter(data)
	if err != nil {
		return nil, err
	}

	d := &Document{
		Path:   filepath.ToSlash(path),
		Body:   body,
		Status: meta.Status,
		Tags:   append([]string(nil), meta.Tags...),
		Aliases: append([]string(nil), meta.Aliases...),
	}
	d.Folder = filepath.ToSlash(filepath.Dir(d.Path))
	if d.Folder == "." {
		d.Folder = ""
	}

	d.Title = meta.Title
	if d.Title == "" {
		d.Title = titleFromBody(body, filepath.Base(path))
	}

	d.InlineTags = ExtractInlineTags(body)
	d.WikiLinks = extractWikiLinks(body)

	return d, nil
}

func splitFrontmatter(data []byte) (Meta, string, error) {
	var meta Meta
	s := string(data)
	if !strings.HasPrefix(s, "---\n") && !strings.HasPrefix(s, "---\r\n") {
		return meta, s, nil
	}

	rest := s[4:]
	if strings.HasPrefix(rest, "\r\n") {
		rest = rest[2:]
	}
	end := strings.Index(rest, "\n---")
	if end < 0 {
		return meta, s, nil
	}
	fm := rest[:end]
	body := rest[end+4:]
	if strings.HasPrefix(body, "\n") {
		body = body[1:]
	} else if strings.HasPrefix(body, "\r\n") {
		body = body[2:]
	}
	if err := parseYAML([]byte(sanitizeFrontmatterYAML(fm)), &meta); err != nil {
		return meta, "", fmt.Errorf("frontmatter: %w", err)
	}
	return meta, body, nil
}

// sanitizeFrontmatterYAML quotes bare {{template}} values so YAML parsers accept them.
func sanitizeFrontmatterYAML(fm string) string {
	lines := strings.Split(fm, "\n")
	for i, line := range lines {
		idx := strings.Index(line, ":")
		if idx < 0 {
			continue
		}
		val := strings.TrimSpace(line[idx+1:])
		if !strings.Contains(val, "{{") || !strings.HasSuffix(val, "}}") {
			continue
		}
		if strings.HasPrefix(val, `"`) || strings.HasPrefix(val, `'`) {
			continue
		}
		lines[i] = line[:idx+1] + ` "` + val + `"`
	}
	return strings.Join(lines, "\n")
}

func titleFromBody(body, filename string) string {
	sc := bufio.NewScanner(strings.NewReader(body))
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if strings.HasPrefix(line, "# ") {
			return strings.TrimSpace(strings.TrimPrefix(line, "# "))
		}
	}
	name := strings.TrimSuffix(filename, filepath.Ext(filename))
	return name
}

func extractWikiLinks(body string) []string {
	var links []string
	seen := make(map[string]struct{})
	i := 0
	for i < len(body) {
		if i+1 < len(body) && body[i] == '[' && body[i+1] == '[' {
			end := strings.Index(body[i+2:], "]]")
			if end < 0 {
				break
			}
			link := body[i+2 : i+2+end]
			// skip transclusion ![[
			if i > 0 && body[i-1] == '!' {
				i += end + 4
				continue
			}
			// strip block/heading refs
			if idx := strings.IndexAny(link, "#^"); idx >= 0 {
				link = link[:idx]
			}
			link = strings.TrimSpace(link)
			if link != "" {
				if _, ok := seen[link]; !ok {
					seen[link] = struct{}{}
					links = append(links, link)
				}
			}
			i += end + 4
			continue
		}
		i++
	}
	return links
}