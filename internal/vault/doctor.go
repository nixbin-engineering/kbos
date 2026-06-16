package vault

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// CheckResult is one doctor finding.
type CheckResult struct {
	OK      bool
	Message string
}

// Doctor runs vault health checks.
func Doctor(v *Vault) []CheckResult {
	var out []CheckResult

	out = append(out, checkExists(filepath.Join(v.Root, "config", "kb.yaml"), "config/kb.yaml"))

	for _, dir := range v.RequiredDirs() {
		rel, _ := filepath.Rel(v.Root, dir)
		out = append(out, checkDir(dir, rel))
	}

	kb := v.KBDir()
	if _, err := os.Stat(kb); err == nil {
		out = append(out, CheckResult{OK: true, Message: ".kb/ present (disposable index cache)"})
	} else {
		out = append(out, CheckResult{OK: true, Message: ".kb/ not yet created (run kb rebuild)"})
	}

	idx := v.SearchIndexPath()
	if _, err := os.Stat(idx); err == nil {
		out = append(out, CheckResult{OK: true, Message: "search index present at .kb/search/bleve"})
	} else {
		out = append(out, CheckResult{OK: true, Message: "search index missing (run kb rebuild)"})
	}

	return out
}

func checkExists(path, label string) CheckResult {
	if _, err := os.Stat(path); err != nil {
		return CheckResult{OK: false, Message: fmt.Sprintf("missing %s", label)}
	}
	return CheckResult{OK: true, Message: fmt.Sprintf("%s ok", label)}
}

func checkDir(path, label string) CheckResult {
	info, err := os.Stat(path)
	if err != nil {
		return CheckResult{OK: false, Message: fmt.Sprintf("missing directory %s", label)}
	}
	if !info.IsDir() {
		return CheckResult{OK: false, Message: fmt.Sprintf("%s is not a directory", label)}
	}
	return CheckResult{OK: true, Message: fmt.Sprintf("%s/ ok", strings.TrimSuffix(label, "/"))}
}
