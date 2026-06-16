package vault

import (
	"fmt"
	"os"
	"path/filepath"
)

// Vault is a KBOS knowledge vault rooted on disk.
type Vault struct {
	Root   string
	Config Config
}

// Open loads an existing vault from root.
func Open(root string) (*Vault, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(filepath.Join(abs, "config", "kb.yaml")); err != nil {
		return nil, fmt.Errorf("not a KBOS vault (missing config/kb.yaml): %w", err)
	}
	cfg, err := LoadConfig(abs)
	if err != nil {
		return nil, err
	}
	return &Vault{Root: abs, Config: cfg}, nil
}

func (v *Vault) DocsDir() string {
	return filepath.Join(v.Root, v.Config.Paths.Docs)
}

func (v *Vault) TemplatesDir() string {
	return filepath.Join(v.Root, v.Config.Paths.Templates)
}

func (v *Vault) AssetsDir() string {
	return filepath.Join(v.Root, v.Config.Paths.Assets)
}

func (v *Vault) KBDir() string {
	return filepath.Join(v.Root, ".kb")
}

func (v *Vault) SearchIndexPath() string {
	return filepath.Join(v.KBDir(), "search", "bleve")
}

// RequiredDirs returns paths that must exist for a healthy vault.
func (v *Vault) RequiredDirs() []string {
	return []string{
		v.DocsDir(),
		v.TemplatesDir(),
		v.AssetsDir(),
		filepath.Join(v.Root, "config"),
	}
}
