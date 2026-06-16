package crypto

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// IsEncryptedName reports whether a docs-relative filename is an encrypted note.
func IsEncryptedName(name string) bool {
	return strings.HasSuffix(strings.ToLower(name), ".md.enc")
}

// EncryptedPath returns the .md.enc path for a note path.
func EncryptedPath(rel string) string {
	rel = strings.TrimSpace(filepath.ToSlash(rel))
	if IsEncryptedName(rel) {
		return rel
	}
	if strings.HasSuffix(strings.ToLower(rel), ".md") {
		return rel + ".enc"
	}
	return rel + ".md.enc"
}

// PlainPath strips .enc from an encrypted note path.
func PlainPath(encRel string) string {
	encRel = filepath.ToSlash(encRel)
	if strings.HasSuffix(strings.ToLower(encRel), ".md.enc") {
		return strings.TrimSuffix(encRel, ".enc")
	}
	return encRel
}

// EncryptFile encrypts a single markdown file to *.md.enc and removes plaintext.
func EncryptFile(absPath, passphrase string) error {
	if IsEncryptedName(filepath.Base(absPath)) {
		return fmt.Errorf("already encrypted: %s", absPath)
	}
	data, err := os.ReadFile(absPath)
	if err != nil {
		return err
	}
	enc, err := Encrypt(data, passphrase)
	if err != nil {
		return err
	}
	out := absPath + ".enc"
	if err := os.WriteFile(out, enc, 0o600); err != nil {
		return err
	}
	return os.Remove(absPath)
}

// DecryptFile decrypts *.md.enc to plaintext markdown and removes the encrypted file.
func DecryptFile(absEncPath, passphrase string) error {
	if !IsEncryptedName(filepath.Base(absEncPath)) {
		return fmt.Errorf("not an encrypted note: %s", absEncPath)
	}
	data, err := os.ReadFile(absEncPath)
	if err != nil {
		return err
	}
	plain, err := Decrypt(data, passphrase)
	if err != nil {
		return fmt.Errorf("decryption failed (wrong passphrase?): %w", err)
	}
	out := strings.TrimSuffix(absEncPath, ".enc")
	if err := os.WriteFile(out, plain, 0o600); err != nil {
		return err
	}
	return os.Remove(absEncPath)
}

// EncryptTree encrypts all .md files under dir (not already .md.enc).
func EncryptTree(rootDir, passphrase string) (int, error) {
	count := 0
	err := filepath.WalkDir(rootDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		name := d.Name()
		if !strings.HasSuffix(strings.ToLower(name), ".md") || IsEncryptedName(name) {
			return nil
		}
		if err := EncryptFile(path, passphrase); err != nil {
			return err
		}
		count++
		return nil
	})
	return count, err
}

// DecryptTree decrypts all .md.enc files under dir.
func DecryptTree(rootDir, passphrase string) (int, error) {
	count := 0
	err := filepath.WalkDir(rootDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if !IsEncryptedName(d.Name()) {
			return nil
		}
		if err := DecryptFile(path, passphrase); err != nil {
			return err
		}
		count++
		return nil
	})
	return count, err
}
