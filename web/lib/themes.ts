export type ThemeId = "light" | "dark" | "auto" | "nord" | "dracula" | "solarized" | "indigo" | "linux-terminal" | "manjaro" | "ocean" | "midnight" | "mono" | "rose" | "slate" | "amber" | "blue-white";

export const THEME_STORAGE_KEY = "kbos-theme";

export type ThemeTokens = {
  background: string;
  foreground: string;
  panel: string;
  panelElevated: string;
  border: string;
  borderStrong: string;
  muted: string;
  accent: string;
  accentFg: string;
  accentDim: string;
  shadowColor: string;
};

export const THEMES: Record<ThemeId, { label: string; tokens: ThemeTokens }> = {
  indigo: {
    label: "Indigo (Dark)",
    tokens: {
      background:    "#07090f",
      foreground:    "#dde3f5",
      panel:         "#0d1120",
      panelElevated: "#131929",
      border:        "#1c2540",
      borderStrong:  "#2a3660",
      muted:         "#5b6b99",
      accent:        "#8b5cf6",
      accentFg:      "#ffffff",
      accentDim:     "rgba(139,92,246,0.15)",
      shadowColor:   "rgba(0,0,8,0.7)",
    },
  },
  dark: {
    label: "Dark",
    tokens: {
      background:    "#0f172a",
      foreground:    "#e2e8f0",
      panel:         "#1e293b",
      panelElevated: "#253348",
      border:        "#334155",
      borderStrong:  "#475569",
      muted:         "#94a3b8",
      accent:        "#3b82f6",
      accentFg:      "#f8fafc",
      accentDim:     "rgba(59,130,246,0.12)",
      shadowColor:   "rgba(0,0,0,0.6)",
    },
  },
  light: {
    label: "Light",
    tokens: {
      background:    "#f5f6ff",
      foreground:    "#1e1b4b",
      panel:         "#ffffff",
      panelElevated: "#f0f1ff",
      border:        "#ddd6fe",
      borderStrong:  "#c4b5fd",
      muted:         "#6d6daa",
      accent:        "#7c3aed",
      accentFg:      "#ffffff",
      accentDim:     "rgba(124,58,237,0.08)",
      shadowColor:   "rgba(100,80,200,0.12)",
    },
  },
  auto: {
    label: "Auto",
    tokens: {
      background:    "#f5f6ff",
      foreground:    "#1e1b4b",
      panel:         "#ffffff",
      panelElevated: "#f0f1ff",
      border:        "#ddd6fe",
      borderStrong:  "#c4b5fd",
      muted:         "#6d6daa",
      accent:        "#7c3aed",
      accentFg:      "#ffffff",
      accentDim:     "rgba(124,58,237,0.08)",
      shadowColor:   "rgba(100,80,200,0.12)",
    },
  },
  nord: {
    label: "Nord",
    tokens: {
      background:    "#2e3440",
      foreground:    "#eceff4",
      panel:         "#3b4252",
      panelElevated: "#434c5e",
      border:        "#4c566a",
      borderStrong:  "#6b7a96",
      muted:         "#a0aec0",
      accent:        "#88c0d0",
      accentFg:      "#2e3440",
      accentDim:     "rgba(136,192,208,0.12)",
      shadowColor:   "rgba(0,0,0,0.5)",
    },
  },
  dracula: {
    label: "Dracula",
    tokens: {
      background:    "#1e1f29",
      foreground:    "#f8f8f2",
      panel:         "#282a36",
      panelElevated: "#383a4a",
      border:        "#44475a",
      borderStrong:  "#6272a4",
      muted:         "#bd93f9",
      accent:        "#ff79c6",
      accentFg:      "#282a36",
      accentDim:     "rgba(255,121,198,0.12)",
      shadowColor:   "rgba(0,0,0,0.6)",
    },
  },
  solarized: {
    label: "Solarized",
    tokens: {
      background:    "#002b36",
      foreground:    "#839496",
      panel:         "#073642",
      panelElevated: "#0a4050",
      border:        "#164550",
      borderStrong:  "#586e75",
      muted:         "#657b83",
      accent:        "#268bd2",
      accentFg:      "#fdf6e3",
      accentDim:     "rgba(38,139,210,0.12)",
      shadowColor:   "rgba(0,0,0,0.5)",
    },
  },
  ocean: {
    label: "Ocean",
    tokens: {
      background:    "#f0f7ff",
      foreground:    "#1a2e45",
      panel:         "#ffffff",
      panelElevated: "#e8f2fd",
      border:        "#c5ddf7",
      borderStrong:  "#93c4ef",
      muted:         "#5a87b5",
      accent:        "#1d6fa4",
      accentFg:      "#ffffff",
      accentDim:     "rgba(29,111,164,0.10)",
      shadowColor:   "rgba(29,111,164,0.12)",
    },
  },
  midnight: {
    label: "Midnight Blue",
    tokens: {
      background:    "#0d1b2a",
      foreground:    "#cdd9e8",
      panel:         "#112236",
      panelElevated: "#162d45",
      border:        "#1e3a56",
      borderStrong:  "#2a5078",
      muted:         "#6b8fad",
      accent:        "#4da6e8",
      accentFg:      "#0d1b2a",
      accentDim:     "rgba(77,166,232,0.12)",
      shadowColor:   "rgba(0,0,0,0.6)",
    },
  },
  mono: {
    label: "Monochrome",
    tokens: {
      background:    "#ffffff",
      foreground:    "#111111",
      panel:         "#f5f5f5",
      panelElevated: "#ebebeb",
      border:        "#d4d4d4",
      borderStrong:  "#a3a3a3",
      muted:         "#737373",
      accent:        "#111111",
      accentFg:      "#ffffff",
      accentDim:     "rgba(17,17,17,0.08)",
      shadowColor:   "rgba(0,0,0,0.15)",
    },
  },
  rose: {
    label: "Rose",
    tokens: {
      background:    "#fff5f7",
      foreground:    "#3d1a20",
      panel:         "#ffffff",
      panelElevated: "#ffeef1",
      border:        "#fac5cf",
      borderStrong:  "#f59baa",
      muted:         "#b06070",
      accent:        "#e0394f",
      accentFg:      "#ffffff",
      accentDim:     "rgba(224,57,79,0.09)",
      shadowColor:   "rgba(224,57,79,0.12)",
    },
  },
  slate: {
    label: "Slate",
    tokens: {
      background:    "#0f1317",
      foreground:    "#d4dae2",
      panel:         "#161c22",
      panelElevated: "#1d252e",
      border:        "#272f38",
      borderStrong:  "#364049",
      muted:         "#6b7c8d",
      accent:        "#7eb8d4",
      accentFg:      "#0f1317",
      accentDim:     "rgba(126,184,212,0.12)",
      shadowColor:   "rgba(0,0,0,0.6)",
    },
  },
  amber: {
    label: "Amber",
    tokens: {
      background:    "#16110a",
      foreground:    "#f0ddb8",
      panel:         "#1e1608",
      panelElevated: "#261c0c",
      border:        "#382808",
      borderStrong:  "#503c10",
      muted:         "#8c7040",
      accent:        "#f5a623",
      accentFg:      "#16110a",
      accentDim:     "rgba(245,166,35,0.12)",
      shadowColor:   "rgba(0,0,0,0.6)",
    },
  },
  "blue-white": {
    label: "Blue & White",
    tokens: {
      background:    "#ffffff",
      foreground:    "#0a1628",
      panel:         "#e8f0fe",
      panelElevated: "#d2e3fc",
      border:        "#a8c7fa",
      borderStrong:  "#6ba3f5",
      muted:         "#4a78c4",
      accent:        "#1a73e8",
      accentFg:      "#ffffff",
      accentDim:     "rgba(26,115,232,0.10)",
      shadowColor:   "rgba(26,115,232,0.15)",
    },
  },
  "linux-terminal": {
    label: "Linux Terminal",
    tokens: {
      background:    "#0a0a0a",
      foreground:    "#00ff00",
      panel:         "#111111",
      panelElevated: "#1a1a1a",
      border:        "#1f3d1f",
      borderStrong:  "#2d5a2d",
      muted:         "#4d7a4d",
      accent:        "#00cc00",
      accentFg:      "#0a0a0a",
      accentDim:     "rgba(0,204,0,0.12)",
      shadowColor:   "rgba(0,255,0,0.1)",
    },
  },
  manjaro: {
    label: "Manjaro",
    tokens: {
      background:    "#2b2c2c",
      foreground:    "#f3f4f5",
      panel:         "#2f343f",
      panelElevated: "#383d4a",
      border:        "#3d4455",
      borderStrong:  "#4a5268",
      muted:         "#8a9bb0",
      accent:        "#16a085",
      accentFg:      "#f3f4f5",
      accentDim:     "rgba(22,160,133,0.15)",
      shadowColor:   "rgba(0,0,0,0.6)",
    },
  },
};

const DARK_THEMES: Set<ThemeId> = new Set(["dark", "indigo", "nord", "dracula", "solarized", "linux-terminal", "manjaro", "midnight", "mono", "slate", "amber"]);

export function isThemeId(v: string): v is ThemeId {
  return v in THEMES;
}

export function applyThemeTokens(tokens: ThemeTokens) {
  const root = document.documentElement;
  root.style.setProperty("--background",     tokens.background);
  root.style.setProperty("--foreground",     tokens.foreground);
  root.style.setProperty("--panel",          tokens.panel);
  root.style.setProperty("--panel-elevated", tokens.panelElevated);
  root.style.setProperty("--border",         tokens.border);
  root.style.setProperty("--border-strong",  tokens.borderStrong);
  root.style.setProperty("--muted",          tokens.muted);
  root.style.setProperty("--accent",         tokens.accent);
  root.style.setProperty("--accent-fg",      tokens.accentFg);
  root.style.setProperty("--accent-dim",     tokens.accentDim);
  root.style.setProperty("--shadow-color",   tokens.shadowColor);
}

export function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getResolvedAppearance(theme: ThemeId): "light" | "dark" {
  if (theme === "auto") return systemPrefersDark() ? "dark" : "light";
  if (theme === "light") return "light";
  if (DARK_THEMES.has(theme)) return "dark";
  return "light";
}

export function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  if (theme === "auto") {
    const darkTokens = THEMES.indigo.tokens;
    const lightTokens = THEMES.light.tokens;
    applyThemeTokens(systemPrefersDark() ? darkTokens : lightTokens);
    return;
  }
  applyThemeTokens(THEMES[theme].tokens);
}
