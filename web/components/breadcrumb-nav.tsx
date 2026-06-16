"use client";

import { ChevronRight, Home } from "lucide-react";

type Props = {
  path: string | null;
  onOpenDoc: (path: string) => void;
  onOpenFolder: (folder: string) => void;
};

export function BreadcrumbNav({ path, onOpenDoc, onOpenFolder }: Props) {
  if (!path) return null;

  const segments = path.split("/");
  // Build crumbs: each segment links to either a folder or the file itself
  const crumbs: { label: string; onClick: () => void }[] = [
    { label: "docs", onClick: () => onOpenFolder("") },
  ];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    const segPath = segments.slice(0, i + 1).join("/");

    if (isLast) {
      // File — strip .md extension for display
      crumbs.push({
        label: seg.replace(/\.md(\.enc)?$/, ""),
        onClick: () => onOpenDoc(segPath),
      });
    } else {
      // Folder segment
      crumbs.push({
        label: seg,
        onClick: () => onOpenFolder(segPath),
      });
    }
  }

  return (
    <nav className="flex items-center gap-0.5 text-xs text-[var(--muted)]" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-0.5">
            {i === 0 ? (
              <button
                type="button"
                onClick={crumb.onClick}
                className="flex items-center gap-0.5 hover:text-[var(--foreground)]"
              >
                <Home className="h-3 w-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={crumb.onClick}
                className={
                  isLast
                    ? "font-medium text-[var(--foreground)]"
                    : "hover:text-[var(--foreground)]"
                }
              >
                {crumb.label}
              </button>
            )}
            {!isLast && <ChevronRight className="h-3 w-3 opacity-40" />}
          </span>
        );
      })}
    </nav>
  );
}
