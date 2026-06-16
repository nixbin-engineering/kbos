"use client";

import { Check, Copy, WrapText, AlignLeft, List, Palette } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import * as PrismStyles from "react-syntax-highlighter/dist/esm/styles/prism";
import { copyToClipboard } from "@/lib/clipboard";
import { useTheme } from "./theme-provider";

type Props = {
  code: string;
  language?: string;
};

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  yml: "yaml",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  md: "markdown",
  rs: "rust",
  go: "go",
  cs: "csharp",
  cpp: "cpp",
  "c++": "cpp",
  kt: "kotlin",
  swift: "swift",
  tf: "hcl",
};

const LANG_COLORS: Record<string, string> = {
  javascript: "#f7df1e",
  typescript: "#3178c6",
  tsx: "#3178c6",
  jsx: "#61dafb",
  python: "#3572a5",
  rust: "#dea584",
  go: "#00add8",
  bash: "#4eaa25",
  sql: "#e38c00",
  html: "#e34c26",
  css: "#563d7c",
  json: "#8bc34a",
  yaml: "#cb171e",
  ruby: "#cc342d",
  php: "#4f5d95",
  java: "#b07219",
  kotlin: "#7f52ff",
  swift: "#f05138",
  csharp: "#512bd4",
  cpp: "#00599c",
  hcl: "#7b42bc",
  docker: "#2496ed",
  markdown: "#083fa1",
};

// Curated theme list: [key in PrismStyles, display label, dark?]
const THEMES: { key: string; label: string; dark: boolean }[] = [
  { key: "vscDarkPlus",        label: "VS Code Dark+",     dark: true  },
  { key: "oneDark",            label: "One Dark",           dark: true  },
  { key: "dracula",            label: "Dracula",            dark: true  },
  { key: "nightOwl",           label: "Night Owl",          dark: true  },
  { key: "nord",               label: "Nord",               dark: true  },
  { key: "gruvboxDark",        label: "Gruvbox Dark",       dark: true  },
  { key: "materialDark",       label: "Material Dark",      dark: true  },
  { key: "materialOceanic",    label: "Material Oceanic",   dark: true  },
  { key: "atomDark",           label: "Atom Dark",          dark: true  },
  { key: "synthwave84",        label: "Synthwave '84",      dark: true  },
  { key: "shadesOfPurple",     label: "Shades of Purple",   dark: true  },
  { key: "okaidia",            label: "Okaidia",            dark: true  },
  { key: "lucario",            label: "Lucario",            dark: true  },
  { key: "xonokai",            label: "Xonokai",            dark: true  },
  { key: "twilight",           label: "Twilight",           dark: true  },
  { key: "duotoneDark",        label: "Duotone Dark",       dark: true  },
  { key: "duotoneSpace",       label: "Duotone Space",      dark: true  },
  { key: "solarizedDarkAtom",  label: "Solarized Dark",     dark: true  },
  { key: "oneLight",           label: "One Light",          dark: false },
  { key: "ghcolors",           label: "GitHub",             dark: false },
  { key: "gruvboxLight",       label: "Gruvbox Light",      dark: false },
  { key: "materialLight",      label: "Material Light",     dark: false },
  { key: "solarizedlight",     label: "Solarized Light",    dark: false },
  { key: "a11yOneLight",       label: "A11y Light",         dark: false },
  { key: "coldarkCold",        label: "Coldark Light",      dark: false },
  { key: "vs",                 label: "Visual Studio",      dark: false },
  { key: "prism",              label: "Prism",              dark: false },
  { key: "duotoneLight",       label: "Duotone Light",      dark: false },
];

const STORAGE_KEY = "kbos-code-theme";
const DEFAULT_DARK  = "vscDarkPlus";
const DEFAULT_LIGHT = "ghcolors";

function normalizeLanguage(lang: string): string {
  const lower = lang.toLowerCase().trim();
  return LANG_ALIASES[lower] ?? lower;
}

function getStyle(key: string): Record<string, React.CSSProperties> {
  // PrismStyles keys are camelCase; the import uses named exports
  const s = (PrismStyles as unknown as Record<string, Record<string, React.CSSProperties>>)[key];
  return s ?? (PrismStyles as unknown as Record<string, Record<string, React.CSSProperties>>)[DEFAULT_DARK];
}

export function MarkdownCodeBlock({ code, language = "text" }: Props) {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  const { resolvedAppearance } = useTheme();
  const dark = resolvedAppearance === "dark";

  const lang = normalizeLanguage(language);
  const lines = code.split("\n").length;
  const [showLineNumbers, setShowLineNumbers] = useState(lines >= 4);
  const langColor = LANG_COLORS[lang];
  const langLabel = lang === "text" ? "plain text" : lang;

  // Per-mode theme preference stored in localStorage
  const [themeKey, setThemeKey] = useState<string>(() => {
    if (typeof window === "undefined") return dark ? DEFAULT_DARK : DEFAULT_LIGHT;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    return dark ? DEFAULT_DARK : DEFAULT_LIGHT;
  });

  // When app theme changes, pick the right default only if user hasn't set one
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setThemeKey(dark ? DEFAULT_DARK : DEFAULT_LIGHT);
  }, [dark]);

  // Close palette on outside click
  useEffect(() => {
    if (!paletteOpen) return;
    const handler = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [paletteOpen]);

  const selectTheme = (key: string) => {
    setThemeKey(key);
    localStorage.setItem(STORAGE_KEY, key);
    setPaletteOpen(false);
  };

  const currentTheme = THEMES.find((t) => t.key === themeKey) ?? THEMES[0];
  const darkThemes  = THEMES.filter((t) => t.dark);
  const lightThemes = THEMES.filter((t) => !t.dark);

  const headerBg   = dark ? "#161824" : "#eaecf0";
  const borderColor = dark ? "#2a2f45" : "#d1d5db";
  const mutedColor  = dark ? "#8b93a8" : "#6e7781";

  const copy = () => {
    if (!copyToClipboard(code)) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="group my-4 overflow-hidden rounded-xl text-sm"
      style={{ border: `1px solid ${borderColor}`, boxShadow: dark ? "0 4px 24px rgba(0,0,0,0.35)" : "0 2px 8px rgba(0,0,0,0.08)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ background: headerBg, borderBottom: `1px solid ${borderColor}` }}
      >
        {/* Left: window dots + language */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="h-3 w-3 rounded-full" style={{ background: "#ff5f57" }} />
            <span className="h-3 w-3 rounded-full" style={{ background: "#ffbd2e" }} />
            <span className="h-3 w-3 rounded-full" style={{ background: "#28c840" }} />
          </div>
          {langColor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: langColor }} />}
          <span className="font-mono text-[11px] font-medium tracking-wide" style={{ color: mutedColor }}>
            {langLabel}
          </span>
          {showLineNumbers && (
            <span className="ml-1 text-[10px]" style={{ color: dark ? "#4a5166" : "#9ca3af" }}>
              {lines} lines
            </span>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-1">
          {/* Theme picker */}
          <div className="relative" ref={paletteRef}>
            <button
              type="button"
              onClick={() => setPaletteOpen((v) => !v)}
              title="Change theme"
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] transition-colors"
              style={{ color: paletteOpen ? (dark ? "#7c6af7" : "#6d28d9") : mutedColor }}
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{currentTheme.label}</span>
            </button>

            {paletteOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border py-1 shadow-xl"
                style={{ background: dark ? "#1a1d2e" : "#ffffff", borderColor }}
              >
                <div className="px-2 pb-1 pt-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: mutedColor }}>Dark themes</p>
                </div>
                {darkThemes.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => selectTheme(t.key)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors"
                    style={{
                      color: themeKey === t.key ? (dark ? "#a78bfa" : "#6d28d9") : (dark ? "#abb2bf" : "#374151"),
                      background: themeKey === t.key ? (dark ? "rgba(124,106,247,0.12)" : "rgba(109,40,217,0.06)") : "transparent",
                    }}
                  >
                    {t.label}
                    {themeKey === t.key && <Check className="h-3 w-3" />}
                  </button>
                ))}
                <div className="mx-2 my-1 border-t" style={{ borderColor }} />
                <div className="px-2 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: mutedColor }}>Light themes</p>
                </div>
                {lightThemes.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => selectTheme(t.key)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors"
                    style={{
                      color: themeKey === t.key ? (dark ? "#a78bfa" : "#6d28d9") : (dark ? "#abb2bf" : "#374151"),
                      background: themeKey === t.key ? (dark ? "rgba(124,106,247,0.12)" : "rgba(109,40,217,0.06)") : "transparent",
                    }}
                  >
                    {t.label}
                    {themeKey === t.key && <Check className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Line numbers toggle */}
          <button
            type="button"
            onClick={() => setShowLineNumbers((v) => !v)}
            title={showLineNumbers ? "Hide line numbers" : "Show line numbers"}
            className="rounded p-1 transition-colors"
            style={{
              color: showLineNumbers ? (dark ? "#7c6af7" : "#6d28d9") : mutedColor,
              background: showLineNumbers ? (dark ? "rgba(124,106,247,0.12)" : "rgba(109,40,217,0.08)") : "transparent",
            }}
          >
            <List className="h-3.5 w-3.5" />
          </button>

          {/* Word wrap toggle */}
          <button
            type="button"
            onClick={() => setWrap((v) => !v)}
            title={wrap ? "Disable word wrap" : "Enable word wrap"}
            className="rounded p-1 transition-colors"
            style={{
              color: wrap ? (dark ? "#7c6af7" : "#6d28d9") : mutedColor,
              background: wrap ? (dark ? "rgba(124,106,247,0.12)" : "rgba(109,40,217,0.08)") : "transparent",
            }}
          >
            {wrap ? <AlignLeft className="h-3.5 w-3.5" /> : <WrapText className="h-3.5 w-3.5" />}
          </button>

          {/* Copy */}
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-all"
            title="Copy code"
            style={{
              color: copied ? "#22c55e" : mutedColor,
              background: copied ? (dark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.08)") : "transparent",
            }}
          >
            {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
          </button>
        </div>
      </div>

      {/* Code area */}
      <div style={{ overflowX: wrap ? "hidden" : "auto" }}>
        <SyntaxHighlighter
          language={lang}
          style={getStyle(themeKey)}
          showLineNumbers={showLineNumbers}
          lineNumberStyle={{
            minWidth: "2.8em",
            paddingRight: "0.75em",
            color: dark ? "#3a3f55" : "#c1c8d4",
            userSelect: "none",
            borderRight: `1px solid ${dark ? "#242840" : "#e2e6ea"}`,
            marginRight: "1em",
            background: "transparent",
          }}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "0.8125rem",
            lineHeight: "1.6",
            whiteSpace: wrap ? "pre-wrap" : "pre",
            wordBreak: wrap ? "break-all" : "normal",
          }}
          codeTagProps={{
            style: { fontFamily: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", background: "transparent" },
          }}
          PreTag="div"
          wrapLines
          wrapLongLines={wrap}
          lineProps={{ style: { background: "transparent", display: wrap ? "block" : "inline" } }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
