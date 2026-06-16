package doc

import "testing"

func TestExtractInlineTags(t *testing.T) {
	body := `# Heading not a tag

Some text with #docker and #linux/ops inline.

` + "```" + `
#not-a-tag-in-code
` + "```" + `

More #welcome here.
`
	tags := ExtractInlineTags(body)
	want := map[string]bool{"docker": true, "linux/ops": true, "welcome": true}
	if len(tags) != len(want) {
		t.Fatalf("got %v", tags)
	}
	for _, tag := range tags {
		if !want[tag] {
			t.Fatalf("unexpected tag %q", tag)
		}
	}
}

func TestMergeTags(t *testing.T) {
	got := MergeTags([]string{"Docker", "api"}, "see also #docker and #new")
	if len(got) != 3 {
		t.Fatalf("got %v", got)
	}
}
