"use client";

import React, { isValidElement, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Components } from "react-markdown";
import { resolveImageSrc } from "@/lib/attachments-client";
import { preprocessWikiMarkdown } from "@/lib/links-parse";
import { extractToc } from "@/lib/toc";
import { MarkdownCodeBlock } from "./markdown-code-block";
import { MarkdownEmbed } from "./markdown-embed";
import { MarkdownMermaid } from "./markdown-mermaid";

type Props = {
  body: string;
  docPath?: string;
  onOpenDoc?: (path: string) => void;
  embedDepth?: number;
};

function makeHeading(level: 1 | 2 | 3 | 4 | 5 | 6, getId: () => string) {
  const cls = "scroll-mt-4";

  if (level === 1) {
    return function H1({ children, ...props }: React.ComponentProps<"h1">) {
      return (
        <h1 id={getId()} className={cls} {...props}>
          {children}
        </h1>
      );
    };
  }
  if (level === 2) {
    return function H2({ children, ...props }: React.ComponentProps<"h2">) {
      return (
        <h2 id={getId()} className={cls} {...props}>
          {children}
        </h2>
      );
    };
  }
  if (level === 3) {
    return function H3({ children, ...props }: React.ComponentProps<"h3">) {
      return (
        <h3 id={getId()} className={cls} {...props}>
          {children}
        </h3>
      );
    };
  }
  if (level === 4) {
    return function H4({ children, ...props }: React.ComponentProps<"h4">) {
      return (
        <h4 id={getId()} className={cls} {...props}>
          {children}
        </h4>
      );
    };
  }
  if (level === 5) {
    return function H5({ children, ...props }: React.ComponentProps<"h5">) {
      return (
        <h5 id={getId()} className={cls} {...props}>
          {children}
        </h5>
      );
    };
  }
  return function H6({ children, ...props }: React.ComponentProps<"h6">) {
    return (
      <h6 id={getId()} className={cls} {...props}>
        {children}
      </h6>
    );
  };
}

function flattenText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) {
    return flattenText(node.props.children);
  }
  return "";
}

function extractCodeFromPre(children: React.ReactNode): { code: string; language?: string } | null {
  const child = React.Children.toArray(children)[0];
  if (!isValidElement<{ className?: string; children?: React.ReactNode }>(child)) return null;

  const className = child.props.className || "";
  const match = /language-([\w-]+)/.exec(className);
  const code = flattenText(child.props.children).replace(/\n$/, "");
  if (!code) return null;

  return { code, language: match?.[1] };
}

function PreBlock({ children }: { children?: React.ReactNode }) {
  const extracted = extractCodeFromPre(children);
  if (extracted) {
    if (extracted.language === "mermaid") {
      return <MarkdownMermaid code={extracted.code} />;
    }
    return <MarkdownCodeBlock code={extracted.code} language={extracted.language} />;
  }
  return (
    <pre className="my-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 text-sm">
      {children}
    </pre>
  );
}

export function MarkdownBody({ body, docPath, onOpenDoc, embedDepth = 0 }: Props) {
  const processed = useMemo(
    () => (embedDepth >= 2 ? body : preprocessWikiMarkdown(body, docPath)),
    [body, docPath, embedDepth],
  );
  const headings = useMemo(() => extractToc(body), [body]);

  const components = useMemo((): Components => {
    let i = 0;
    const next = () => headings[i++]?.id ?? `section-${i}`;

    return {
      blockquote: ({ children }) => {
        // Detect GitHub/Obsidian-style callouts: > [!NOTE], > [!TIP], etc.
        const childArr = React.Children.toArray(children);
        const firstP = childArr.find(
          (c): c is React.ReactElement<{ children?: React.ReactNode }> =>
            isValidElement(c) && (c.type === "p" || (c as React.ReactElement<{ node?: unknown }>).props.node !== undefined)
        );
        const firstText = firstP ? flattenText(firstP.props.children) : flattenText(children);
        const match = /^\[!(NOTE|TIP|WARNING|DANGER|IMPORTANT|INFO|CAUTION)\]/i.exec(firstText.trim());
        if (match) {
          const type = match[1].toLowerCase() as string;
          const typeMap: Record<string, { icon: string; label: string; cls: string }> = {
            note:      { icon: "ℹ️",  label: "Note",      cls: "callout-note" },
            tip:       { icon: "💡",  label: "Tip",       cls: "callout-tip" },
            warning:   { icon: "⚠️",  label: "Warning",   cls: "callout-warning" },
            caution:   { icon: "⚠️",  label: "Caution",   cls: "callout-warning" },
            danger:    { icon: "🔴",  label: "Danger",    cls: "callout-danger" },
            important: { icon: "📌",  label: "Important", cls: "callout-important" },
            info:      { icon: "💬",  label: "Info",      cls: "callout-info" },
          };
          const { icon, label, cls } = typeMap[type] ?? { icon: "📝", label: type, cls: "callout-note" };
          // Strip the [!TYPE] marker from the first paragraph's text
          const restChildren = childArr.map((c, idx) => {
            if (idx !== childArr.indexOf(firstP!)) return c;
            const text = flattenText((c as React.ReactElement<{children?: React.ReactNode}>).props.children);
            const stripped = text.replace(/^\[!(NOTE|TIP|WARNING|DANGER|IMPORTANT|INFO|CAUTION)\]\s*/i, "").trim();
            return stripped ? <p key="callout-body">{stripped}</p> : null;
          }).filter(Boolean);
          return (
            <blockquote className={`callout ${cls}`}>
              <span className="callout-icon" aria-hidden="true">{icon}</span>
              <div className="callout-content">
                <div className="callout-title">{label}</div>
                {restChildren}
              </div>
            </blockquote>
          );
        }
        return (
          <blockquote className="markdown-preview-blockquote border-l-4 border-[var(--border-strong)] pl-4 italic text-[var(--muted)] my-4">
            {children}
          </blockquote>
        );
      },
      h1: makeHeading(1, next),
      h2: makeHeading(2, next),
      h3: makeHeading(3, next),
      h4: makeHeading(4, next),
      h5: makeHeading(5, next),
      h6: makeHeading(6, next),
      pre: PreBlock,
      a: ({ href, children, ...props }) => {
        if (href?.startsWith("kbos://wiki/")) {
          const target = decodeURIComponent(href.slice("kbos://wiki/".length));
          return (
            <button
              type="button"
              className="text-[var(--accent)] underline hover:opacity-80"
              onClick={async () => {
                if (!onOpenDoc) return;
                const params = new URLSearchParams({ target });
                if (docPath) params.set("from", docPath);
                const r = await fetch(`/api/links?${params}`);
                if (!r.ok) return;
                const resolved = await r.json();
                if (resolved.path) onOpenDoc(resolved.path);
              }}
            >
              {children}
            </button>
          );
        }
        return (
          <a href={href} {...props} className="text-[var(--accent)] underline">
            {children}
          </a>
        );
      },
      div: ({ className, node, ...props }) => {
        const cn = typeof className === "string" ? className : "";
        if (cn.includes("kbos-embed") && embedDepth < 2) {
          const el = node as { properties?: Record<string, unknown> };
          const p = props as Record<string, unknown>;
          const target = String(p["data-target"] ?? el.properties?.["data-target"] ?? "");
          const sectionRaw = p["data-section"] ?? el.properties?.["data-section"];
          const blockRaw = p["data-block"] ?? el.properties?.["data-block"];
          const fromRaw = p["data-from"] ?? el.properties?.["data-from"];
          const section = sectionRaw ? String(sectionRaw) : undefined;
          const block = blockRaw ? String(blockRaw) : undefined;
          const from = fromRaw ? String(fromRaw) : docPath;
          return (
            <MarkdownEmbed
              target={target}
              section={section}
              block={block}
              fromPath={from}
              onOpenDoc={onOpenDoc}
            />
          );
        }
        return <div className={className} {...props} />;
      },
      code: ({ className, children, ...props }) => {
        if (className?.includes("language-")) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
        return (
          <code
            className="rounded-md border border-[var(--border)] bg-[var(--panel-elevated)] px-[0.4em] py-[0.15em] font-mono text-[0.875em] text-[var(--accent)]"
            {...props}
          >
            {children}
          </code>
        );
      },
      li: ({ className, children, ...props }) => {
        const isTask = className === "task-list-item";
        if (isTask) {
          return (
            <li className="flex items-start gap-2 list-none" {...props}>
              {children}
            </li>
          );
        }
        return <li className={className} {...props}>{children}</li>;
      },
      input: ({ type, checked, ...props }) => {
        if (type === "checkbox") {
          return (
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)] cursor-default"
              {...props}
            />
          );
        }
        return <input type={type} {...props} />;
      },
      table: ({ children, ...props }) => (
        <div className="my-4 w-full overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="min-w-full text-sm" {...props}>{children}</table>
        </div>
      ),
      thead: ({ children, ...props }) => (
        <thead className="bg-[var(--border)]/40 text-xs uppercase tracking-wide text-[var(--muted)]" {...props}>{children}</thead>
      ),
      tbody: ({ children, ...props }) => (
        <tbody className="divide-y divide-[var(--border)]" {...props}>{children}</tbody>
      ),
      tr: ({ children, ...props }) => (
        <tr className="transition-colors hover:bg-[var(--border)]/20" {...props}>{children}</tr>
      ),
      th: ({ children, ...props }) => (
        <th className="px-4 py-2.5 text-left font-medium" {...props}>{children}</th>
      ),
      td: ({ children, ...props }) => (
        <td className="px-4 py-2.5" {...props}>{children}</td>
      ),
      img: ({ src, alt, ...props }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...props}
          src={typeof src === "string" ? resolveImageSrc(docPath, src) : src}
          alt={alt || ""}
          className="my-2 max-w-full rounded-md border border-[var(--border)]"
          loading="lazy"
        />
      ),
    };
  }, [headings, docPath, onOpenDoc, embedDepth]);

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
      {processed}
    </ReactMarkdown>
  );
}

export function scrollToHeading(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
