package cli

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/nt-kb/kbos/internal/vault"
	"github.com/spf13/cobra"
)

func attachCmd() *cobra.Command {
	var notePath string
	cmd := &cobra.Command{
		Use:   "attach [image-file]",
		Short: "Copy an image into a note's attachments folder",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if notePath == "" {
				return exitErr(fmt.Errorf("--note is required (e.g. projects/guide.md)"))
			}
			notePath = strings.TrimSpace(strings.ReplaceAll(notePath, "\\", "/"))
			if !strings.HasSuffix(notePath, ".md") {
				return exitErr(fmt.Errorf("--note must be a markdown path ending in .md"))
			}

			root, err := resolveVault()
			if err != nil {
				return exitErr(err)
			}
			v, err := vault.Open(root)
			if err != nil {
				return exitErr(err)
			}

			src := args[0]
			ext := strings.ToLower(filepath.Ext(src))
			switch ext {
			case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg":
			default:
				return exitErr(fmt.Errorf("unsupported image type %q", ext))
			}

			subdir := v.Config.UI.AttachmentsSubdir
			if subdir == "" {
				subdir = "attachments"
			}
			subdir = strings.Trim(subdir, "/\\")

			noteDir := filepath.Dir(notePath)
			var destDir string
			if noteDir == "." || noteDir == "" {
				destDir = filepath.Join(v.DocsDir(), subdir)
			} else {
				destDir = filepath.Join(v.DocsDir(), noteDir, subdir)
			}

			if err := os.MkdirAll(destDir, 0o755); err != nil {
				return exitErr(err)
			}

			base := filepath.Base(src)
			dest := filepath.Join(destDir, base)
			if _, err := os.Stat(dest); err == nil {
				stem := strings.TrimSuffix(base, ext)
				for i := 2; ; i++ {
					candidate := filepath.Join(destDir, fmt.Sprintf("%s-%d%s", stem, i, ext))
					if _, err := os.Stat(candidate); err != nil {
						dest = candidate
						base = filepath.Base(candidate)
						break
					}
				}
			}

			in, err := os.Open(src)
			if err != nil {
				return exitErr(err)
			}
			defer in.Close()

			out, err := os.Create(dest)
			if err != nil {
				return exitErr(err)
			}
			defer out.Close()

			if _, err := io.Copy(out, in); err != nil {
				return exitErr(err)
			}

			markdown := fmt.Sprintf("![%s](%s/%s)", strings.TrimSuffix(base, ext), subdir, base)
			fmt.Println(markdown)
			return nil
		},
	}
	cmd.Flags().StringVar(&notePath, "note", "", "note path relative to docs/ (required)")
	return cmd
}
