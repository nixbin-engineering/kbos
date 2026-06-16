package auth

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gopkg.in/yaml.v3"
)

const UsersFile = "users.yaml"

// User record stored on disk (authoritative in config/).
type User struct {
	PasswordHash string `yaml:"password_hash"`
	Role         string `yaml:"role"` // admin | user
	CreatedAt    string `yaml:"created_at"`
}

// Store is config/users.yaml.
type Store struct {
	Mode          string           `yaml:"mode"` // public | local | proxy | setup
	SessionSecret string           `yaml:"session_secret,omitempty"`
	Users         map[string]User  `yaml:"users"`
}

func usersPath(vaultRoot string) string {
	return filepath.Join(vaultRoot, "config", UsersFile)
}

// Load reads config/users.yaml. Missing file → setup required.
func Load(vaultRoot string) (*Store, error) {
	path := usersPath(vaultRoot)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Store{Mode: "setup", Users: map[string]User{}}, nil
		}
		return nil, err
	}
	var s Store
	if err := yaml.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("parse users.yaml: %w", err)
	}
	if s.Users == nil {
		s.Users = map[string]User{}
	}
	return &s, nil
}

// Save writes config/users.yaml.
func Save(vaultRoot string, s *Store) error {
	if err := os.MkdirAll(filepath.Join(vaultRoot, "config"), 0o755); err != nil {
		return err
	}
	data, err := yaml.Marshal(s)
	if err != nil {
		return err
	}
	return os.WriteFile(usersPath(vaultRoot), data, 0o600)
}

// NeedsSetup is true when no local users exist yet.
func NeedsSetup(vaultRoot string) (bool, error) {
	s, err := Load(vaultRoot)
	if err != nil {
		return false, err
	}
	return len(s.Users) == 0, nil
}

// HashPassword bcrypt-hashes a password.
func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// CheckPassword verifies a password against a hash.
func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// AddUser creates or updates a user.
func (s *Store) AddUser(username, password, role string) error {
	if username == "" || password == "" {
		return fmt.Errorf("username and password required")
	}
	if role == "" {
		role = "user"
	}
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	if s.Users == nil {
		s.Users = map[string]User{}
	}
	s.Users[username] = User{
		PasswordHash: hash,
		Role:         role,
		CreatedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	return nil
}

// RemoveUser deletes a user.
func (s *Store) RemoveUser(username string) error {
	if _, ok := s.Users[username]; !ok {
		return fmt.Errorf("user not found: %s", username)
	}
	delete(s.Users, username)
	return nil
}

// SetPassword changes a user's password.
func (s *Store) SetPassword(username, password string) error {
	u, ok := s.Users[username]
	if !ok {
		return fmt.Errorf("user not found: %s", username)
	}
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	u.PasswordHash = hash
	s.Users[username] = u
	return nil
}

// Authenticate returns username and role if valid.
func (s *Store) Authenticate(username, password string) (string, string, error) {
	u, ok := s.Users[username]
	if !ok {
		return "", "", fmt.Errorf("invalid credentials")
	}
	if !CheckPassword(u.PasswordHash, password) {
		return "", "", fmt.Errorf("invalid credentials")
	}
	return username, u.Role, nil
}

// CompleteSetup creates first admin and enables local auth.
func CompleteSetup(vaultRoot, adminUser, adminPassword string) error {
	s, err := Load(vaultRoot)
	if err != nil {
		return err
	}
	if len(s.Users) > 0 {
		return fmt.Errorf("setup already completed")
	}
	if err := s.AddUser(adminUser, adminPassword, "admin"); err != nil {
		return err
	}
	s.Mode = "local"
	secret, err := EnsureSessionSecret(s)
	if err != nil {
		return err
	}
	s.SessionSecret = secret
	if err := Save(vaultRoot, s); err != nil {
		return err
	}
	// Update kb.yaml auth mode
	return setKBAuthMode(vaultRoot, "local")
}

func setKBAuthMode(vaultRoot, mode string) error {
	path := filepath.Join(vaultRoot, "config", "kb.yaml")
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var raw map[string]any
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return err
	}
	auth, _ := raw["auth"].(map[string]any)
	if auth == nil {
		auth = map[string]any{}
		raw["auth"] = auth
	}
	auth["mode"] = mode
	out, err := yaml.Marshal(raw)
	if err != nil {
		return err
	}
	return os.WriteFile(path, out, 0o644)
}
