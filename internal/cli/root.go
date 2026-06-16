package cli

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

var vaultPath string

// Execute runs the kb CLI.
func Execute() error {
	root := &cobra.Command{
		Use:   "kb",
		Short: "KBOS — Knowledge Base Operating System",
		Long:  "Local-first knowledge base CLI. Markdown on disk is the source of truth.",
	}
	root.PersistentFlags().StringVarP(&vaultPath, "vault", "V", ".", "vault root directory")

	root.AddCommand(initCmd())
	root.AddCommand(rebuildCmd())
	root.AddCommand(doctorCmd())
	root.AddCommand(searchCmd())
	root.AddCommand(attachCmd())
	root.AddCommand(encryptCmd())
	root.AddCommand(decryptCmd())
	root.AddCommand(userCmd())
	root.AddCommand(setupCmd())

	return root.Execute()
}

func resolveVault() (string, error) {
	p := vaultPath
	if p == "" {
		p = "."
	}
	return filepath.Abs(p)
}

func exitErr(err error) error {
	fmt.Fprintf(os.Stderr, "error: %v\n", err)
	return err
}
