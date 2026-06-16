"use client";

import { Palette, X } from "lucide-react";
import { useState } from "react";
import { THEMES, type ThemeId } from "@/lib/themes";
import { useTheme } from "./theme-provider";

const THEME_ORDER: ThemeId[] = ["indigo", "dark", "midnight", "slate", "amber", "nord", "dracula", "solarized", "linux-terminal", "manjaro", "light", "auto", "ocean", "blue-white", "mono", "rose"];

const THEME_PREVIEW: Record<ThemeId, { bg: string; panel: string; accent: string }> = {
  indigo:    { bg: "#07090f", panel: "#0d1120", accent: "#8b5cf6" },
  dark:      { bg: "#0f172a", panel: "#1e293b", accent: "#3b82f6" },
  light:     { bg: "#f5f6ff", panel: "#ffffff", accent: "#7c3aed" },
  auto:      { bg: "#f5f6ff", panel: "#ffffff", accent: "#7c3aed" },
  nord:      { bg: "#2e3440", panel: "#3b4252", accent: "#88c0d0" },
  dracula:   { bg: "#1e1f29", panel: "#282a36", accent: "#ff79c6" },
  solarized:        { bg: "#002b36", panel: "#073642", accent: "#268bd2" },
  "linux-terminal": { bg: "#0a0a0a", panel: "#111111", accent: "#00cc00" },
  manjaro:          { bg: "#2b2c2c", panel: "#2f343f", accent: "#16a085" },
  ocean:            { bg: "#f0f7ff", panel: "#ffffff", accent: "#1d6fa4" },
  midnight:         { bg: "#0d1b2a", panel: "#112236", accent: "#4da6e8" },
  mono:             { bg: "#ffffff", panel: "#f5f5f5", accent: "#111111" },
  rose:             { bg: "#fff5f7", panel: "#ffffff", accent: "#e0394f" },
  slate:            { bg: "#0f1317", panel: "#161c22", accent: "#7eb8d4" },
  amber:            { bg: "#16110a", panel: "#1e1608", accent: "#f5a623" },
  "blue-white":     { bg: "#ffffff", panel: "#e8f0fe", accent: "#1a73e8" },
};

export function UserPreferencesButton() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <>
      <button
        type="button"
        title="Theme"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-sm hover:bg-[var(--border)]"
      >
        <Palette className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border-strong,var(--border))] bg-[var(--panel-elevated,var(--panel))] p-5 shadow-accent-glow animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Theme</h2>
              <button type="button" onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 hover:bg-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {THEME_ORDER.map((id) => {
                const preview = THEME_PREVIEW[id];
                const active = theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setTheme(id); setOpen(false); }}
                    className={`group relative overflow-hidden rounded-lg border p-3 text-left transition-all ${
                      active
                        ? "border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--background)]"
                        : "border-[var(--border)] hover:border-[var(--border-strong,var(--border))] hover:shadow-elev-1"
                    }`}
                    style={{ background: preview.bg }}
                  >
                    {/* Mini preview */}
                    <div className="mb-2 flex gap-1">
                      <div className="h-3 w-3 rounded-sm opacity-80" style={{ background: preview.panel }} />
                      <div className="h-3 flex-1 rounded-sm opacity-60" style={{ background: preview.panel }} />
                    </div>
                    <div className="h-1.5 w-8 rounded-full mb-1" style={{ background: preview.accent }} />
                    <div className="h-1 w-12 rounded-full opacity-40" style={{ background: preview.panel }} />
                    <p className="mt-2 text-[11px] font-medium" style={{ color: preview.panel === "#ffffff" ? "#1e1b4b" : "#e2e8f0" }}>
                      {THEMES[id].label}
                    </p>
                    {active && (
                      <div className="absolute right-2 top-2 h-2 w-2 rounded-full" style={{ background: preview.accent }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
