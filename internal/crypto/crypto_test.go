package crypto

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	plain := []byte("---\ntitle: Secret\n---\n\n# Hello\n")
	enc, err := Encrypt(plain, "test-passphrase")
	if err != nil {
		t.Fatal(err)
	}
	got, err := Decrypt(enc, "test-passphrase")
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(plain) {
		t.Fatalf("round trip mismatch:\n%s", got)
	}
	_, err = Decrypt(enc, "wrong")
	if err == nil {
		t.Fatal("expected decrypt error with wrong passphrase")
	}
}

func TestEncryptFileTree(t *testing.T) {
	dir := t.TempDir()
	note := filepath.Join(dir, "note.md")
	if err := os.WriteFile(note, []byte("# hi"), 0o600); err != nil {
		t.Fatal(err)
	}
	sub := filepath.Join(dir, "sub")
	if err := os.Mkdir(sub, 0o755); err != nil {
		t.Fatal(err)
	}
	note2 := filepath.Join(sub, "other.md")
	if err := os.WriteFile(note2, []byte("# there"), 0o600); err != nil {
		t.Fatal(err)
	}

	n, err := EncryptTree(dir, "pw")
	if err != nil || n != 2 {
		t.Fatalf("encrypt tree: count=%d err=%v", n, err)
	}
	if _, err := os.Stat(note); !os.IsNotExist(err) {
		t.Fatal("plaintext should be removed")
	}
	if _, err := os.Stat(note + ".enc"); err != nil {
		t.Fatal("encrypted file missing")
	}

	n, err = DecryptTree(dir, "pw")
	if err != nil || n != 2 {
		t.Fatalf("decrypt tree: count=%d err=%v", n, err)
	}
	data, err := os.ReadFile(note)
	if err != nil || string(data) != "# hi" {
		t.Fatalf("restored note: %q err=%v", data, err)
	}
}
