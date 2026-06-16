package auth

import (
	"crypto/rand"
	"encoding/hex"
)

// EnsureSessionSecret returns existing or generates a new session secret.
func EnsureSessionSecret(s *Store) (string, error) {
	if s.SessionSecret != "" {
		return s.SessionSecret, nil
	}
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
