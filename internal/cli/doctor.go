package cli

import (
	"fmt"

	"github.com/nt-kb/kbos/internal/vault"
	"github.com/spf13/cobra"
)

func doctorCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "doctor",
		Short: "Check vault health",
		RunE: func(cmd *cobra.Command, args []string) error {
			root, err := resolveVault()
			if err != nil {
				return exitErr(err)
			}
			v, err := vault.Open(root)
			if err != nil {
				return exitErr(err)
			}
			results := vault.Doctor(v)
			ok := true
			for _, r := range results {
				mark := "ok"
				if !r.OK {
					mark = "FAIL"
					ok = false
				}
				fmt.Printf("[%s] %s\n", mark, r.Message)
			}
			if !ok {
				return exitErr(fmt.Errorf("vault has issues"))
			}
			return nil
		},
	}
}
