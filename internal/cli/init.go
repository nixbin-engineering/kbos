package cli

import (
	"fmt"

	"github.com/nt-kb/kbos/internal/vault"
	"github.com/spf13/cobra"
)

func initCmd() *cobra.Command {
	var path string
	cmd := &cobra.Command{
		Use:   "init [path]",
		Short: "Initialize a new KBOS vault",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			root := "."
			if len(args) > 0 {
				root = args[0]
			}
			if path != "" {
				root = path
			}
			v, err := vault.Init(root)
			if err != nil {
				return exitErr(err)
			}
			fmt.Printf("Initialized KBOS vault at %s\n", v.Root)
			fmt.Println("Next: kb rebuild && kb search welcome")
			return nil
		},
	}
	cmd.Flags().StringVar(&path, "path", "", "vault directory (default: current dir or arg)")
	return cmd
}
