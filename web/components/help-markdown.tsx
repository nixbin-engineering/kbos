"use client";

import { MarkdownBody } from "./markdown-body";

type Part = { kind: "md" | "example"; text: string };

function parseHelpBody(body: string): Part[] {
  const parts: Part[] = [];
  const re = /^:::example\r?\n([\s\S]*?)\r?\n:::\s*(?:\r?\n|$)/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "md", text: body.slice(lastIndex, match.index) });
    }
    parts.push({ kind: "example", text: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    parts.push({ kind: "md", text: body.slice(lastIndex) });
  }
  return parts.length > 0 ? parts : [{ kind: "md", text: body }];
}

function HelpExample({ source }: { source: string }) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="min-w-0 border-[var(--border)] md:border-r">
          <div className="border-b border-[var(--border)] bg-[var(--border)]/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Markdown
          </div>
          <pre className="max-h-48 overflow-auto p-3 font-mono text-xs leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
            {source.trimEnd()}
          </pre>
        </div>
        <div className="min-w-0">
          <div className="border-b border-[var(--border)] bg-[var(--border)]/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Preview
          </div>
          <div className="max-h-48 overflow-auto p-3">
            <MarkdownBody body={source} />
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = {
  body: string;
};

/** Help guide markdown — renders `:::example` blocks as side-by-side syntax + preview cards. */
export function HelpMarkdownBody({ body }: Props) {
  const parts = parseHelpBody(body);
  return (
    <div className="help-guide">
      {parts.map((part, i) =>
        part.kind === "example" ? (
          <HelpExample key={`ex-${i}`} source={part.text} />
        ) : (
          part.text.trim() ? <MarkdownBody key={`md-${i}`} body={part.text} /> : null
        ),
      )}
    </div>
  );
}
