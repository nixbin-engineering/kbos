package vault

import (
	"os"
	"path/filepath"
	"testing"
)

func TestInitAndDoctor(t *testing.T) {
	dir := t.TempDir()
	v, err := Init(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(v.Root, "docs", "home.md")); err != nil {
		t.Fatal(err)
	}
	results := Doctor(v)
	for _, r := range results {
		if !r.OK {
			t.Fatalf("doctor failed: %s", r.Message)
		}
	}
}
