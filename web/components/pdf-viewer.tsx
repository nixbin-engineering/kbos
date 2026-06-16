// Integrate in kbos-shell.tsx: when the selected file ends with ".pdf",
// render <PdfViewer filePath={path} fileName={basename} /> instead of <DocWorkspace />.

"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

type Props = {
  filePath: string;
  fileName?: string;
};

export function PdfViewer({ filePath, fileName }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Build a safe URL: encode each path segment individually.
  const src =
    "/api/files/" +
    filePath
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");

  const displayName = fileName ?? filePath.split("/").pop() ?? "document.pdf";

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Toolbar — matches doc-workspace.tsx header style */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 shrink-0 text-[var(--muted)]" />
          <span className="text-sm font-medium truncate text-[var(--foreground)]">
            {displayName}
          </span>
        </div>

        <a
          href={src}
          download={displayName}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--panel)] transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </a>
      </div>

      {/* Main viewer area */}
      <div className="relative flex-1 overflow-hidden bg-[var(--panel)]">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--panel)]">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--muted)]" />
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
            <FileText className="w-10 h-10" />
            <p className="text-sm">Failed to load PDF.</p>
            <a
              href={src}
              download={displayName}
              className="text-xs px-3 py-1.5 rounded border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--panel)] transition-colors"
            >
              Download instead
            </a>
          </div>
        ) : (
          <iframe
            src={src}
            className="h-full w-full border-0"
            title={displayName}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
