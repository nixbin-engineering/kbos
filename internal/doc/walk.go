package doc

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// WalkDocs visits every .md file under docsRoot.
func WalkDocs(docsRoot string, fn func(rel string, data []byte) error) error {
	return filepath.WalkDir(docsRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if !strings.EqualFold(filepath.Ext(path), ".md") {
			return nil
		}
		if strings.HasSuffix(strings.ToLower(path), ".md.enc") {
			return nil
		}
		rel, err := filepath.Rel(docsRoot, path)
		if err != nil {
			return err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return fn(filepath.ToSlash(rel), data)
	})
}

// LoadAll parses all documents under docsRoot.
func LoadAll(docsRoot string) ([]*Document, error) {
	var docs []*Document
	err := WalkDocs(docsRoot, func(rel string, data []byte) error {
		d, err := Parse(rel, data)
		if err != nil {
			return err
		}
		docs = append(docs, d)
		return nil
	})
	return docs, err
}
