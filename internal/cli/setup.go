package cli

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/nt-kb/kbos/internal/auth"
	"github.com/nt-kb/kbos/internal/vault"
	"github.com/spf13/cobra"
)

func setupCmd() *cobra.Command {
	var username, password string
	cmd := &cobra.Command{
		Use:   "setup",
		Short: "First-run setup: create admin user and enable local auth",
		RunE: func(cmd *cobra.Command, args []string) error {
			root, err := resolveVault()
			if err != nil {
				return exitErr(err)
			}
			if _, err := vault.Open(root); err != nil {
				return exitErr(err)
			}
			needs, err := auth.NeedsSetup(root)
			if err != nil {
				return exitErr(err)
			}
			if !needs {
				return exitErr(fmt.Errorf("setup already completed — use kb user add"))
			}
			user := username
			if user == "" {
				fmt.Fprint(os.Stderr, "Admin username: ")
				line, _ := bufio.NewReader(os.Stdin).ReadString('\n')
				user = strings.TrimSpace(line)
			}
			if user == "" {
				user = "admin"
			}
			pass := password
			if pass == "" {
				pass, err = promptPassword("Admin password: ")
				if err != nil {
					return exitErr(err)
				}
				confirm, err := promptPassword("Confirm password: ")
				if err != nil {
					return exitErr(err)
				}
				if pass != confirm {
					return exitErr(fmt.Errorf("passwords do not match"))
				}
			}
			if err := auth.CompleteSetup(root, user, pass); err != nil {
				return exitErr(err)
			}
			fmt.Printf("Setup complete. Admin user %q created. Auth mode: local\n", user)
			fmt.Println("Start the web UI and sign in with these credentials.")
			return nil
		},
	}
	cmd.Flags().StringVarP(&username, "username", "u", "", "admin username (default: admin)")
	cmd.Flags().StringVarP(&password, "password", "p", "", "admin password (prompted if omitted)")
	return cmd
}
