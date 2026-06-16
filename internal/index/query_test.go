package index

import "testing"

func TestParseQuery(t *testing.T) {
	q := ParseQuery("tag:docker folder:linux welcome")
	if q.Tag != "docker" || q.Folder != "linux" || q.Text != "welcome" {
		t.Fatalf("got %+v", q)
	}
}
