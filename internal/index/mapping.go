package index

import (
	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
)

func newIndexMapping() mapping.IndexMapping {
	im := bleve.NewIndexMapping()

	doc := bleve.NewDocumentMapping()
	doc.AddFieldMappingsAt("path", textField(true))
	doc.AddFieldMappingsAt("title", textField(true))
	doc.AddFieldMappingsAt("body", textField(true))
	doc.AddFieldMappingsAt("folder", textField(true))
	doc.AddFieldMappingsAt("status", keywordField())
	doc.AddFieldMappingsAt("tags", keywordField())
	doc.AddFieldMappingsAt("aliases", keywordField())

	im.DefaultMapping = doc
	im.DefaultAnalyzer = "en"
	return im
}

func textField(store bool) *mapping.FieldMapping {
	fm := bleve.NewTextFieldMapping()
	fm.Store = store
	return fm
}

func keywordField() *mapping.FieldMapping {
	fm := bleve.NewKeywordFieldMapping()
	fm.Store = true
	return fm
}
