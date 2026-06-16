package crypto

import (
	"encoding/json"
	"fmt"
)

const (
	FormatVersion = 1
	FormatName    = "kbos-enc"
	KDFName       = "argon2id"
	CipherName    = "aes-256-gcm"
)

// KDFParams holds Argon2id parameters (memory is KiB).
type KDFParams struct {
	Time    uint32 `json:"time"`
	Memory  uint32 `json:"memory"`
	Threads uint8  `json:"threads"`
	Salt    string `json:"salt"`
}

// Envelope is the on-disk JSON format for *.md.enc files.
type Envelope struct {
	Format     string    `json:"format"`
	Version    int       `json:"version"`
	KDF        string    `json:"kdf"`
	KDFParams  KDFParams `json:"kdf_params"`
	Cipher     string    `json:"cipher"`
	Nonce      string    `json:"nonce"`
	Ciphertext string    `json:"ciphertext"`
}

func DefaultKDFParams(saltB64 string) KDFParams {
	return KDFParams{
		Time:    3,
		Memory:  65536,
		Threads: 4,
		Salt:    saltB64,
	}
}

func MarshalEnvelope(e Envelope) ([]byte, error) {
	return json.MarshalIndent(e, "", "  ")
}

func ParseEnvelope(data []byte) (Envelope, error) {
	var e Envelope
	if err := json.Unmarshal(data, &e); err != nil {
		return Envelope{}, err
	}
	if e.Format != FormatName || e.Version != FormatVersion {
		return Envelope{}, fmt.Errorf("unsupported envelope format %q v%d", e.Format, e.Version)
	}
	if e.KDF != KDFName || e.Cipher != CipherName {
		return Envelope{}, fmt.Errorf("unsupported algorithms kdf=%q cipher=%q", e.KDF, e.Cipher)
	}
	return e, nil
}
