package index

import (
	"fmt"
	"strings"
)

// ParsedQuery splits advanced filters from free text.
type ParsedQuery struct {
	Text   string
	Tag    string
	Folder string
	Title  string
	Status string
}

// ParseQuery understands tag: folder: title: status: prefixes.
func ParseQuery(raw string) ParsedQuery {
	var q ParsedQuery
	var textParts []string
	for _, part := range strings.Fields(raw) {
		if strings.HasPrefix(part, "tag:") {
			q.Tag = strings.TrimPrefix(part, "tag:")
			continue
		}
		if strings.HasPrefix(part, "folder:") {
			q.Folder = strings.TrimPrefix(part, "folder:")
			continue
		}
		if strings.HasPrefix(part, "title:") {
			q.Title = strings.TrimPrefix(part, "title:")
			continue
		}
		if strings.HasPrefix(part, "status:") {
			q.Status = strings.TrimPrefix(part, "status:")
			continue
		}
		textParts = append(textParts, part)
	}
	q.Text = strings.Join(textParts, " ")
	return q
}

func (q ParsedQuery) bleveQuery() string {
	var clauses []string

	if q.Text != "" {
		t := quote(q.Text)
		clauses = append(clauses, fmt.Sprintf("title:%s body:%s", t, t))
	}
	if q.Tag != "" {
		clauses = append(clauses, fmt.Sprintf(`+tags:%s`, quote(q.Tag)))
	}
	if q.Folder != "" {
		clauses = append(clauses, fmt.Sprintf(`+folder:%s*`, quote(q.Folder)))
	}
	if q.Title != "" {
		clauses = append(clauses, fmt.Sprintf(`+title:%s*`, quote(q.Title)))
	}
	if q.Status != "" {
		clauses = append(clauses, fmt.Sprintf(`+status:%s`, quote(q.Status)))
	}

	if len(clauses) == 0 {
		return "*"
	}
	return strings.Join(clauses, " ")
}

func quote(s string) string {
	return fmt.Sprintf("%q", s)
}
