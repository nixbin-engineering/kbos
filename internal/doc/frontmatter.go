package doc

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

type flexibleMeta struct {
	Title   interface{} `yaml:"title"`
	Tags    interface{} `yaml:"tags"`
	Aliases interface{} `yaml:"aliases"`
	Status  interface{} `yaml:"status"`
	Created interface{} `yaml:"created"`
	Updated interface{} `yaml:"updated"`
}

func parseYAML(data []byte, out *Meta) error {
	var flex flexibleMeta
	if err := yaml.Unmarshal(data, &flex); err != nil {
		return err
	}
	out.Title = coerceString(flex.Title)
	out.Tags = coerceStringSlice(flex.Tags)
	out.Aliases = coerceStringSlice(flex.Aliases)
	out.Status = coerceString(flex.Status)
	out.Created = coerceString(flex.Created)
	out.Updated = coerceString(flex.Updated)
	return nil
}

func coerceString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func coerceStringSlice(v interface{}) []string {
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case string:
		s := strings.TrimSpace(t)
		if s == "" {
			return nil
		}
		return []string{s}
	case []string:
		return append([]string(nil), t...)
	case []interface{}:
		out := make([]string, 0, len(t))
		for _, item := range t {
			if s, ok := item.(string); ok {
				s = strings.TrimSpace(s)
				if s != "" {
					out = append(out, s)
				}
			}
		}
		return out
	default:
		return nil
	}
}

// UnmarshalMeta is exported for tests that need direct YAML coercion checks.
func UnmarshalMeta(data []byte) (Meta, error) {
	var m Meta
	if err := parseYAML(data, &m); err != nil {
		return Meta{}, fmt.Errorf("frontmatter: %w", err)
	}
	return m, nil
}
