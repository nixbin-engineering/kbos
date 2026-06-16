package cli

import (
	"fmt"

	"github.com/nt-kb/kbos/internal/index"
	"github.com/nt-kb/kbos/internal/vault"
	"github.com/spf13/cobra"
)

func rebuildCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "rebuild",
		Short: "Rebuild all indexes from the vault filesystem",
		RunE: func(cmd *cobra.Command, args []string) error {
			root, err := resolveVault()
			if err != nil {
				return exitErr(err)
			}
			v, err := vault.Open(root)
			if err != nil {
				return exitErr(err)
			}
			n, err := index.Rebuild(v)
			if err != nil {
				return exitErr(err)
			}
			fmt.Printf("Rebuilt search index: %d documents indexed\n", n)
			return nil
		},
	}
}
