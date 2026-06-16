package cli

import (
	"fmt"

	"github.com/nt-kb/kbos/internal/index"
	"github.com/nt-kb/kbos/internal/vault"
	"github.com/spf13/cobra"
)

func searchCmd() *cobra.Command {
	var limit int
	cmd := &cobra.Command{
		Use:   "search [query]",
		Short: "Search the vault (supports tag: folder: title: status:)",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			root, err := resolveVault()
			if err != nil {
				return exitErr(err)
			}
			v, err := vault.Open(root)
			if err != nil {
				return exitErr(err)
			}
			idx, err := index.Open(v)
			if err != nil {
				return exitErr(err)
			}
			defer idx.Close()

			query := args[0]
			if len(args) > 1 {
				query = fmt.Sprintf("%s", joinArgs(args))
			}
			hits, err := idx.Search(query, limit)
			if err != nil {
				return exitErr(err)
			}
			if len(hits) == 0 {
				fmt.Println("No results.")
				return nil
			}
			for _, h := range hits {
				fmt.Printf("%.2f  %s  %s\n", h.Score, h.Path, h.Title)
			}
			return nil
		},
	}
	cmd.Flags().IntVar(&limit, "limit", 20, "max results")
	return cmd
}

func joinArgs(args []string) string {
	s := args[0]
	for i := 1; i < len(args); i++ {
		s += " " + args[i]
	}
	return s
}
