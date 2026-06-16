package cli

import (
	"bufio"
	"fmt"
	"strings"

	kcrypt "github.com/nt-kb/kbos/internal/crypto"
	"github.com/nt-kb/kbos/internal/vault"
	"github.com/spf13/cobra"
	"golang.org/x/term"
	"os"
)

func encryptCmd() *cobra.Command {
	var folder bool
	var passStdin bool
	cmd := &cobra.Command{
		Use:   "encrypt [path]",
		Short: "Encrypt a note or folder to *.md.enc on disk",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			pass, err := readPassphraseInteractive(passStdin, "Passphrase: ")
			if err != nil {
				return exitErr(err)
			}
			if !passStdin {
				confirm, err := readPassphraseInteractive(false, "Confirm passphrase: ")
				if err != nil {
					return exitErr(err)
				}
				if pass != confirm {
					return exitErr(fmt.Errorf("passphrases do not match"))
				}
			}

			root, err := resolveVault()
			if err != nil {
				return exitErr(err)
			}
			v, err := vault.Open(root)
			if err != nil {
				return exitErr(err)
			}

			rel := strings.Trim(strings.ReplaceAll(args[0], "\\", "/"), "/")
			if folder {
				dir := v.DocsDir()
				if rel != "" {
					dir = fmt.Sprintf("%s/%s", v.DocsDir(), rel)
				}
				n, err := kcrypt.EncryptTree(dir, pass)
				if err != nil {
					return exitErr(err)
				}
				fmt.Printf("Encrypted %d note(s) under docs/%s\n", n, rel)
				return nil
			}

			if !strings.HasSuffix(strings.ToLower(rel), ".md") {
				rel += ".md"
			}
			abs := fmt.Sprintf("%s/%s", v.DocsDir(), rel)
			if err := kcrypt.EncryptFile(abs, pass); err != nil {
				return exitErr(err)
			}
			fmt.Printf("Encrypted docs/%s → docs/%s\n", rel, kcrypt.EncryptedPath(rel))
			return nil
		},
	}
	cmd.Flags().BoolVar(&folder, "folder", false, "encrypt all notes in folder recursively")
	cmd.Flags().BoolVar(&passStdin, "passphrase-stdin", false, "read passphrase from stdin (no confirm)")
	return cmd
}

func decryptCmd() *cobra.Command {
	var folder bool
	var passStdin bool
	var stdout bool
	cmd := &cobra.Command{
		Use:   "decrypt [path]",
		Short: "Decrypt a *.md.enc note or folder back to plaintext markdown",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			pass, err := readPassphraseInteractive(passStdin, "Passphrase: ")
			if err != nil {
				return exitErr(err)
			}

			root, err := resolveVault()
			if err != nil {
				return exitErr(err)
			}
			v, err := vault.Open(root)
			if err != nil {
				return exitErr(err)
			}

			rel := strings.Trim(strings.ReplaceAll(args[0], "\\", "/"), "/")

			if stdout {
				if folder {
					return exitErr(fmt.Errorf("--stdout requires a single encrypted note path"))
				}
				if !kcrypt.IsEncryptedName(rel) {
					rel = kcrypt.EncryptedPath(rel)
				}
				abs := fmt.Sprintf("%s/%s", v.DocsDir(), rel)
				data, err := os.ReadFile(abs)
				if err != nil {
					return exitErr(err)
				}
				plain, err := kcrypt.Decrypt(data, pass)
				if err != nil {
					return exitErr(err)
				}
				os.Stdout.Write(plain)
				return nil
			}

			if folder {
				dir := v.DocsDir()
				if rel != "" {
					dir = fmt.Sprintf("%s/%s", v.DocsDir(), rel)
				}
				n, err := kcrypt.DecryptTree(dir, pass)
				if err != nil {
					return exitErr(err)
				}
				fmt.Printf("Decrypted %d note(s) under docs/%s\n", n, rel)
				return nil
			}

			if !kcrypt.IsEncryptedName(rel) {
				rel = kcrypt.EncryptedPath(rel)
			}
			abs := fmt.Sprintf("%s/%s", v.DocsDir(), rel)
			if err := kcrypt.DecryptFile(abs, pass); err != nil {
				return exitErr(err)
			}
			fmt.Printf("Decrypted docs/%s\n", kcrypt.PlainPath(rel))
			return nil
		},
	}
	cmd.Flags().BoolVar(&folder, "folder", false, "decrypt all encrypted notes in folder recursively")
	cmd.Flags().BoolVar(&passStdin, "passphrase-stdin", false, "read passphrase from stdin")
	cmd.Flags().BoolVar(&stdout, "stdout", false, "write decrypted note to stdout (single file only; no disk write)")
	return cmd
}

func readPassphraseInteractive(stdin bool, prompt string) (string, error) {
	if stdin {
		line, err := bufio.NewReader(os.Stdin).ReadString('\n')
		if err != nil {
			return "", err
		}
		return strings.TrimRight(line, "\r\n"), nil
	}
	return readPassphrase(prompt)
}

func readPassphrase(prompt string) (string, error) {
	fmt.Fprint(os.Stderr, prompt)
	b, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
