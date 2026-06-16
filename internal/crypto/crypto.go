package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"golang.org/x/crypto/argon2"
)

const keyLen = 32

func deriveKey(passphrase string, p KDFParams) ([]byte, error) {
	salt, err := base64.StdEncoding.DecodeString(p.Salt)
	if err != nil {
		return nil, fmt.Errorf("decode salt: %w", err)
	}
	return argon2.IDKey([]byte(passphrase), salt, p.Time, p.Memory, p.Threads, keyLen), nil
}

// Encrypt returns JSON envelope bytes for plaintext.
func Encrypt(plaintext []byte, passphrase string) ([]byte, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	params := DefaultKDFParams(base64.StdEncoding.EncodeToString(salt))
	key, err := deriveKey(passphrase, params)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	sealed := gcm.Seal(nil, nonce, plaintext, nil)

	env := Envelope{
		Format:     FormatName,
		Version:    FormatVersion,
		KDF:        KDFName,
		KDFParams:  params,
		Cipher:     CipherName,
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		Ciphertext: base64.StdEncoding.EncodeToString(sealed),
	}
	return MarshalEnvelope(env)
}

// Decrypt parses envelope JSON and returns plaintext.
func Decrypt(data []byte, passphrase string) ([]byte, error) {
	env, err := ParseEnvelope(data)
	if err != nil {
		return nil, err
	}
	key, err := deriveKey(passphrase, env.KDFParams)
	if err != nil {
		return nil, err
	}
	nonce, err := base64.StdEncoding.DecodeString(env.Nonce)
	if err != nil {
		return nil, fmt.Errorf("decode nonce: %w", err)
	}
	ct, err := base64.StdEncoding.DecodeString(env.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("decode ciphertext: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, nonce, ct, nil)
}
