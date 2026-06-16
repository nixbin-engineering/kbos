package cli

import (
	"fmt"
	"os"
	"syscall"

	"github.com/nt-kb/kbos/internal/auth"
	"github.com/nt-kb/kbos/internal/vault"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

func userCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "user",
		Short: "Manage local users",
	}
	cmd.AddCommand(userAddCmd(), userListCmd(), userRemoveCmd(), userPasswdCmd())
	return cmd
}

func userAddCmd() *cobra.Command {
	var password, role string
	var admin bool
	cmd := &cobra.Command{
		Use:   "add USERNAME",
		Short: "Create a local user",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			root, err := resolveVault()
			if err != nil {
				return exitErr(err)
			}
			if _, err := vault.Open(root); err != nil {
				return exitErr(err)
			}
			pass := password
			if pass == "" {
				pass, err = promptPassword("New password: ")
				if err != nil {
					return exitErr(err)
				}
			}
			r := role
			if admin {
				r = "admin"
			}
			if r == "" {
				r = "user"
			}
			store, err := auth.Load(root)
			if err != nil {
				return exitErr(err)
			}
			if store.Mode == "setup" || len(store.Users) == 0 {
				store.Mode = "local"
				secret, err := auth.EnsureSessionSecret(store)
				if err != nil {
					return exitErr(err)
				}
				store.SessionSecret = secret
			}
			if err := store.AddUser(args[0], pass, r); err != nil {
				return exitErr(err)
			}
			if err := auth.Save(root, store); err != nil {
				return exitErr(err)
			}
			fmt.Printf("User %q created (role: %s)\n", args[0], r)
			return nil
		},
	}
	cmd.Flags().StringVarP(&password, "password", "p", "", "password (prompted if omitted)")
	cmd.Flags().StringVar(&role, "role", "", "role: admin or user")
	cmd.Flags().BoolVar(&admin, "admin", false, "grant admin role")
	return cmd
}

func userListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List local users",
		RunE: func(cmd *cobra.Command, args []string) error {
			root, err := resolveVault()
			if err != nil {
				return exitErr(err)
			}
			store, err := auth.Load(root)
			if err != nil {
				return exitErr(err)
			}
			fmt.Printf("auth mode: %s\n", store.Mode)
			if len(store.Users) == 0 {
				fmt.Println("No users configured (setup wizard or kb user add)")
				return nil
			}
			for name, u := range store.Users {
				fmt.Printf("  %s  role=%s  created=%s\n", name, u.Role, u.CreatedAt)
			}
			return nil
		},
	}
}

func userRemoveCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "remove USERNAME",
		Aliases: []string{"rm", "delete"},
		Short:   "Remove a local user",
		Args:    cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			root, err := resolveVault()
			if err != nil {
				return exitErr(err)
			}
			store, err := auth.Load(root)
			if err != nil {
				return exitErr(err)
			}
			if err := store.RemoveUser(args[0]); err != nil {
				return exitErr(err)
			}
			if err := auth.Save(root, store); err != nil {
				return exitErr(err)
			}
			fmt.Printf("Removed user %q\n", args[0])
			return nil
		},
	}
}

func userPasswdCmd() *cobra.Command {
	var password string
	cmd := &cobra.Command{
		Use:   "passwd USERNAME",
		Short: "Change user password",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			root, err := resolveVault()
			if err != nil {
				return exitErr(err)
			}
			pass := password
			if pass == "" {
				pass, err = promptPassword("New password: ")
				if err != nil {
					return exitErr(err)
				}
			}
			store, err := auth.Load(root)
			if err != nil {
				return exitErr(err)
			}
			if err := store.SetPassword(args[0], pass); err != nil {
				return exitErr(err)
			}
			if err := auth.Save(root, store); err != nil {
				return exitErr(err)
			}
			fmt.Printf("Password updated for %q\n", args[0])
			return nil
		},
	}
	cmd.Flags().StringVarP(&password, "password", "p", "", "new password")
	return cmd
}

func promptPassword(label string) (string, error) {
	fmt.Fprint(os.Stderr, label)
	b, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", err
	}
	if len(b) < 8 {
		return "", fmt.Errorf("password must be at least 8 characters")
	}
	return string(b), nil
}
