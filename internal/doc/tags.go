package doc

import (
	"regexp"
	"strings"
)

var inlineTagRE = regexp.MustCompile(`(?:^|[\s([{>])#([a-zA-Z][a-zA-Z0-9_/-]*)`)

// ExtractInlineTags finds #tags in body (skips headings and fenced code).
func ExtractInlineTags(body string) []string {
	seen := make(map[string]struct{})
	var tags []string
	inFence := false

	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "```") {
			inFence = !inFence
			continue
		}
		if inFence {
			continue
		}
		if len(trimmed) > 0 && trimmed[0] == '#' {
			if i := strings.Index(trimmed, " "); i > 0 && i <= 6 {
				allHash := true
				for j := 0; j < i; j++ {
					if trimmed[j] != '#' {
						allHash = false
						break
					}
				}
				if allHash {
					continue
				}
			}
		}

		for _, m := range inlineTagRE.FindAllStringSubmatch(line, -1) {
			tag := strings.ToLower(m[1])
			if _, ok := seen[tag]; ok {
				continue
			}
			seen[tag] = struct{}{}
			tags = append(tags, tag)
		}
	}
	return tags
}

// MergeTags combines frontmatter and inline tags (lowercase, unique).
func MergeTags(frontmatter []string, body string) []string {
	seen := make(map[string]struct{})
	var out []string
	add := func(t string) {
		t = strings.ToLower(strings.TrimSpace(t))
		if t == "" {
			return
		}
		if _, ok := seen[t]; ok {
			return
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	for _, t := range frontmatter {
		add(t)
	}
	for _, t := range ExtractInlineTags(body) {
		add(t)
	}
	return out
}
