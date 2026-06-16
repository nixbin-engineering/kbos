package vault

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Config is loaded from config/kb.yaml.
type Config struct {
	Vault struct {
		Name string `yaml:"name"`
	} `yaml:"vault"`
	Paths struct {
		Docs      string `yaml:"docs"`
		Templates string `yaml:"templates"`
		Assets    string `yaml:"assets"`
	} `yaml:"paths"`
	Index struct {
		Fuzzy bool `yaml:"fuzzy"`
	} `yaml:"index"`
	Auth struct {
		Mode string `yaml:"mode"`
	} `yaml:"auth"`
	AI struct {
		Enabled  bool   `yaml:"enabled"`
		Provider string `yaml:"provider"`
	} `yaml:"ai"`
	Backup struct {
		RetentionDays int `yaml:"retention_days"`
	} `yaml:"backup"`
	UI struct {
		AutosaveSeconds   int    `yaml:"autosave_seconds"`
		AttachmentsSubdir string `yaml:"attachments_subdir"`
	} `yaml:"ui"`
}

func defaultConfig() Config {
	var c Config
	c.Vault.Name = "default"
	c.Paths.Docs = "docs"
	c.Paths.Templates = "templates"
	c.Paths.Assets = "assets"
	c.Index.Fuzzy = true
	c.Auth.Mode = "public"
	c.AI.Enabled = false
	c.AI.Provider = "ollama"
	c.Backup.RetentionDays = 30
	c.UI.AutosaveSeconds = 5
	c.UI.AttachmentsSubdir = "attachments"
	return c
}

// LoadConfig reads config/kb.yaml from the vault root.
func LoadConfig(root string) (Config, error) {
	path := filepath.Join(root, "config", "kb.yaml")
	data, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("read config: %w", err)
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}
	if cfg.Paths.Docs == "" {
		cfg.Paths.Docs = "docs"
	}
	if cfg.Paths.Templates == "" {
		cfg.Paths.Templates = "templates"
	}
	if cfg.Paths.Assets == "" {
		cfg.Paths.Assets = "assets"
	}
	if cfg.UI.AutosaveSeconds <= 0 {
		cfg.UI.AutosaveSeconds = 5
	}
	if cfg.UI.AttachmentsSubdir == "" {
		cfg.UI.AttachmentsSubdir = "attachments"
	}
	return cfg, nil
}

// SaveConfig writes config/kb.yaml.
func SaveConfig(root string, cfg Config) error {
	if err := os.MkdirAll(filepath.Join(root, "config"), 0o755); err != nil {
		return err
	}
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(root, "config", "kb.yaml"), data, 0o644)
}
