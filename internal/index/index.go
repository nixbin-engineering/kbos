package index

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/blevesearch/bleve/v2"
	"github.com/nt-kb/kbos/internal/doc"
	"github.com/nt-kb/kbos/internal/vault"
)

// indexedDoc is stored in Bleve.
type indexedDoc struct {
	Path    string   `json:"path"`
	Title   string   `json:"title"`
	Body    string   `json:"body"`
	Folder  string   `json:"folder"`
	Status  string   `json:"status"`
	Tags    []string `json:"tags"`
	Aliases []string `json:"aliases"`
}

// SearchHit is a query result.
type SearchHit struct {
	Path   string
	Title  string
	Score  float64
}

// Index wraps a Bleve index for a vault.
type Index struct {
	path string
	ix   bleve.Index
}

// Open opens or creates the search index at vault.SearchIndexPath().
func Open(v *vault.Vault) (*Index, error) {
	path := v.SearchIndexPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}

	ix, err := bleve.Open(path)
	if err == bleve.ErrorIndexPathDoesNotExist {
		ix, err = bleve.New(path, newIndexMapping())
	}
	if err != nil {
		return nil, fmt.Errorf("open index: %w", err)
	}
	return &Index{path: path, ix: ix}, nil
}

// Close closes the Bleve index.
func (idx *Index) Close() error {
	return idx.ix.Close()
}

// Rebuild wipes and rebuilds the index from docs/.
func Rebuild(v *vault.Vault) (int, error) {
	path := v.SearchIndexPath()
	_ = os.RemoveAll(path)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return 0, err
	}

	ix, err := bleve.New(path, newIndexMapping())
	if err != nil {
		return 0, err
	}
	defer ix.Close()

	docs, err := doc.LoadAll(v.DocsDir())
	if err != nil {
		return 0, err
	}

	for _, d := range docs {
		tags := doc.MergeTags(d.Tags, d.Body)
		entry := indexedDoc{
			Path:    d.Path,
			Title:   d.Title,
			Body:    d.Body,
			Folder:  d.Folder,
			Status:  d.Status,
			Tags:    tags,
			Aliases: d.Aliases,
		}
		if err := ix.Index(d.Path, entry); err != nil {
			return 0, fmt.Errorf("index %s: %w", d.Path, err)
		}
	}
	return len(docs), nil
}

// Search runs a query against the index.
func (idx *Index) Search(raw string, limit int) ([]SearchHit, error) {
	if limit <= 0 {
		limit = 20
	}
	pq := ParseQuery(raw)
	q := bleve.NewQueryStringQuery(pq.bleveQuery())
	req := bleve.NewSearchRequest(q)
	req.Size = limit
	req.Fields = []string{"title", "path"}

	res, err := idx.ix.Search(req)
	if err != nil {
		return nil, err
	}

	var hits []SearchHit
	for _, m := range res.Hits {
		title, _ := m.Fields["title"].(string)
		hits = append(hits, SearchHit{
			Path:  m.ID,
			Title: title,
			Score: m.Score,
		})
	}
	return hits, nil
}

func uniqueStrings(in []string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, s := range in {
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}
