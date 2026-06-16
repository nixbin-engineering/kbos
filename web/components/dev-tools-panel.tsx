"use client";

import { useState, useCallback, useRef } from "react";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { createTwoFilesPatch } from "diff";
import {
  Braces, FileCode2, Hash, KeyRound, Link, Clock, Regex,
  Shuffle, Binary, Palette, Network, Dna, Copy, Check, RefreshCw,
  AlertCircle, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

async function sha(algo: string, text: string): Promise<string> {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64encode(s: string): string {
  try { return btoa(unescape(encodeURIComponent(s))); } catch { return "Invalid input"; }
}
function b64decode(s: string): string {
  try { return decodeURIComponent(escape(atob(s.trim()))); } catch { return "Invalid base64"; }
}
function urlEnc(s: string): string { try { return encodeURIComponent(s); } catch { return s; } }
function urlDec(s: string): string { try { return decodeURIComponent(s); } catch { return "Invalid encoding"; } }

function parseUrl(raw: string): Record<string, string> | null {
  try {
    const u = new URL(raw.includes("://") ? raw : "https://" + raw);
    return {
      protocol: u.protocol,
      host: u.host,
      hostname: u.hostname,
      port: u.port || "(default)",
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
    };
  } catch { return null; }
}

function decodeJwt(token: string): { header: unknown; payload: unknown } | null {
  try {
    const parts = token.trim().split(".");
    if (parts.length < 2) return null;
    const dec = (s: string) => JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/")));
    return { header: dec(parts[0]), payload: dec(parts[1]) };
  } catch { return null; }
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomB64(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr));
}

function uuidv4(): string {
  return crypto.randomUUID();
}

function baseConvert(val: string, fromBase: number, toBases: number[]): Record<string, string> {
  try {
    const n = BigInt("0x" + parseInt(val.trim(), fromBase).toString(16));
    const result: Record<string, string> = {};
    if (toBases.includes(2)) result.binary = n.toString(2);
    if (toBases.includes(8)) result.octal = n.toString(8);
    if (toBases.includes(10)) result.decimal = n.toString(10);
    if (toBases.includes(16)) result.hex = n.toString(16).toUpperCase();
    return result;
  } catch { return {}; }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// ── small UI atoms ────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={copy}
      className="rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Field({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mb-1.5">
      <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <div className={cn("flex items-start gap-1 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1", mono && "font-mono text-xs")}>
        <span className="flex-1 break-all text-sm">{value}</span>
        <CopyBtn text={value} />
      </div>
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 6 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 font-mono text-xs resize-y outline-none focus:ring-1 focus:ring-[var(--accent)]"
    />
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {msg}
    </div>
  );
}

// ── tools ─────────────────────────────────────────────────────────────────────

function JsonTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [indent, setIndent] = useState(2);

  const format = () => {
    try { setOutput(JSON.stringify(JSON.parse(input), null, indent)); setError(null); }
    catch (e) { setError(String(e)); setOutput(""); }
  };
  const minify = () => {
    try { setOutput(JSON.stringify(JSON.parse(input))); setError(null); }
    catch (e) { setError(String(e)); setOutput(""); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-[var(--muted)]">Indent</label>
        {[2, 4].map((n) => (
          <button key={n} type="button" onClick={() => setIndent(n)}
            className={cn("rounded px-2 py-0.5 text-xs border", indent === n ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]" : "border-[var(--border)]")}>
            {n}
          </button>
        ))}
        <button type="button" onClick={format} className="ml-2 rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)]">Format</button>
        <button type="button" onClick={minify} className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs">Minify</button>
      </div>
      <Textarea value={input} onChange={setInput} placeholder="Paste JSON here…" rows={7} />
      {error && <Err msg={error} />}
      {output && (
        <div className="relative">
          <div className="absolute right-2 top-2"><CopyBtn text={output} /></div>
          <Textarea value={output} onChange={setOutput} rows={7} />
        </div>
      )}
    </div>
  );
}

function YamlJsonTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dir, setDir] = useState<"yaml→json" | "json→yaml">("yaml→json");

  const convert = () => {
    setError(null);
    try {
      if (dir === "yaml→json") {
        setOutput(JSON.stringify(yamlParse(input), null, 2));
      } else {
        setOutput(yamlStringify(JSON.parse(input)));
      }
    } catch (e) { setError(String(e)); setOutput(""); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(["yaml→json", "json→yaml"] as const).map((d) => (
          <button key={d} type="button" onClick={() => setDir(d)}
            className={cn("rounded px-3 py-1 text-xs border", dir === d ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]" : "border-[var(--border)]")}>
            {d}
          </button>
        ))}
        <button type="button" onClick={convert} className="ml-auto rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)]">Convert</button>
      </div>
      <Textarea value={input} onChange={setInput} placeholder={dir === "yaml→json" ? "Paste YAML…" : "Paste JSON…"} rows={7} />
      {error && <Err msg={error} />}
      {output && (
        <div className="relative">
          <div className="absolute right-2 top-2"><CopyBtn text={output} /></div>
          <Textarea value={output} onChange={setOutput} rows={7} />
        </div>
      )}
    </div>
  );
}

function Base64Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  const run = () => setOutput(mode === "encode" ? b64encode(input) : b64decode(input));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(["encode", "decode"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={cn("rounded px-3 py-1 text-xs border capitalize", mode === m ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]" : "border-[var(--border)]")}>
            {m}
          </button>
        ))}
        <button type="button" onClick={run} className="ml-auto rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)]">Run</button>
      </div>
      <Textarea value={input} onChange={setInput} placeholder={mode === "encode" ? "Text to encode…" : "Base64 to decode…"} rows={4} />
      {output && (
        <div className="relative">
          <div className="absolute right-2 top-2"><CopyBtn text={output} /></div>
          <Textarea value={output} onChange={setOutput} rows={4} />
        </div>
      )}
    </div>
  );
}

function UrlTool() {
  const [input, setInput] = useState("");
  const [encOut, setEncOut] = useState("");
  const [decOut, setDecOut] = useState("");
  const parsed = input.includes("://") || input.includes("/") ? parseUrl(input) : null;

  return (
    <div className="space-y-3">
      <Textarea value={input} onChange={setInput} placeholder="Paste URL or text…" rows={3} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setEncOut(urlEnc(input))}
          className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)]">Encode</button>
        <button type="button" onClick={() => setDecOut(urlDec(input))}
          className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs">Decode</button>
      </div>
      {encOut && <Field label="Encoded" value={encOut} />}
      {decOut && <Field label="Decoded" value={decOut} />}
      {parsed && (
        <div className="rounded-lg border border-[var(--border)] p-3 space-y-1">
          <p className="mb-2 text-xs font-medium">URL parts</p>
          {Object.entries(parsed).filter(([, v]) => v && v !== "(default)" && v !== "").map(([k, v]) => (
            <Field key={k} label={k} value={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function JwtTool() {
  const [token, setToken] = useState("");
  const decoded = token.trim() ? decodeJwt(token) : null;
  const payload = decoded?.payload as Record<string, unknown> | null;
  const exp = payload?.exp ? new Date((payload.exp as number) * 1000) : null;
  const expired = exp ? exp < new Date() : false;

  return (
    <div className="space-y-3">
      <Textarea value={token} onChange={setToken} placeholder="Paste JWT token…" rows={4} />
      <p className="text-[10px] text-[var(--muted)]">Decoded locally — token never leaves your browser.</p>
      {token && !decoded && <Err msg="Invalid JWT format" />}
      {decoded && (
        <>
          <div>
            <p className="mb-1 text-xs font-medium">Header</p>
            <pre className="overflow-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 text-xs">{JSON.stringify(decoded.header, null, 2)}</pre>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium">Payload</p>
            <pre className="overflow-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 text-xs">{JSON.stringify(decoded.payload, null, 2)}</pre>
          </div>
          {exp && (
            <div className={cn("rounded-lg border px-3 py-2 text-xs", expired ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300" : "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-300")}>
              {expired ? "⚠ Expired" : "✓ Valid"} · expires {exp.toLocaleString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HashTool() {
  const [input, setInput] = useState("");
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!input) return;
    setBusy(true);
    const [sha1, sha256, sha512] = await Promise.all([
      sha("SHA-1", input),
      sha("SHA-256", input),
      sha("SHA-512", input),
    ]);
    setHashes({ "SHA-1": sha1, "SHA-256": sha256, "SHA-512": sha512 });
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <Textarea value={input} onChange={setInput} placeholder="Text to hash…" rows={4} />
      <button type="button" onClick={run} disabled={busy || !input}
        className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50">
        {busy ? "Hashing…" : "Hash"}
      </button>
      {Object.entries(hashes).map(([algo, h]) => (
        <Field key={algo} label={algo} value={h} />
      ))}
    </div>
  );
}

function UuidTool() {
  const [uuids, setUuids] = useState<string[]>([uuidv4()]);
  const [count, setCount] = useState(1);

  const generate = () => setUuids(Array.from({ length: Math.min(count, 20) }, () => uuidv4()));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-[var(--muted)]">Count</label>
        <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))}
          className="w-16 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs" />
        <button type="button" onClick={generate}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)]">
          <RefreshCw className="h-3 w-3" /> Generate
        </button>
        <CopyBtn text={uuids.join("\n")} />
      </div>
      <div className="space-y-1">
        {uuids.map((u, i) => (
          <div key={i} className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 font-mono text-xs">
            <span>{u}</span>
            <CopyBtn text={u} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RandomBytesTool() {
  const [size, setSize] = useState(32);
  const [fmt, setFmt] = useState<"hex" | "base64">("hex");
  const [output, setOutput] = useState("");

  const generate = () => setOutput(fmt === "hex" ? randomHex(size) : randomB64(size));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-[var(--muted)]">Bytes</label>
        {[16, 32, 64, 128].map((n) => (
          <button key={n} type="button" onClick={() => setSize(n)}
            className={cn("rounded px-2 py-0.5 text-xs border", size === n ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]" : "border-[var(--border)]")}>
            {n}
          </button>
        ))}
        <input type="number" min={1} max={512} value={size} onChange={(e) => setSize(Number(e.target.value))}
          className="w-16 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs" />
        {(["hex", "base64"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFmt(f)}
            className={cn("rounded px-2 py-0.5 text-xs border", fmt === f ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]" : "border-[var(--border)]")}>
            {f}
          </button>
        ))}
        <button type="button" onClick={generate}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)]">
          <RefreshCw className="h-3 w-3" /> Generate
        </button>
      </div>
      {output && <Field label={`${size} bytes · ${fmt}`} value={output} />}
    </div>
  );
}

function TimestampTool() {
  const [input, setInput] = useState(String(Math.floor(Date.now() / 1000)));
  const [dateInput, setDateInput] = useState("");

  const ts = parseInt(input.trim());
  const isMs = ts > 1e12;
  const date = isNaN(ts) ? null : new Date(isMs ? ts : ts * 1000);

  const nowTs = () => setInput(String(Math.floor(Date.now() / 1000)));
  const fromDate = () => {
    try { setInput(String(Math.floor(new Date(dateInput).getTime() / 1000))); } catch { /**/ }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Unix timestamp"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 font-mono text-sm" />
        <button type="button" onClick={nowTs}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs">Now</button>
      </div>
      {date && !isNaN(date.getTime()) && (
        <>
          <Field label={isMs ? "Detected: milliseconds" : "Detected: seconds"} value="" />
          <Field label="ISO 8601" value={date.toISOString()} />
          <Field label="UTC" value={date.toUTCString()} />
          <Field label="Local" value={date.toLocaleString()} />
          <Field label="Relative" value={(() => {
            const diff = Math.round((Date.now() - date.getTime()) / 1000);
            if (Math.abs(diff) < 60) return `${Math.abs(diff)}s ${diff > 0 ? "ago" : "from now"}`;
            if (Math.abs(diff) < 3600) return `${Math.round(Math.abs(diff) / 60)}m ${diff > 0 ? "ago" : "from now"}`;
            if (Math.abs(diff) < 86400) return `${Math.round(Math.abs(diff) / 3600)}h ${diff > 0 ? "ago" : "from now"}`;
            return `${Math.round(Math.abs(diff) / 86400)}d ${diff > 0 ? "ago" : "from now"}`;
          })()} />
        </>
      )}
      <div className="border-t border-[var(--border)] pt-3">
        <p className="mb-2 text-xs text-[var(--muted)]">Date → timestamp</p>
        <div className="flex gap-2">
          <input type="datetime-local" value={dateInput} onChange={(e) => setDateInput(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm" />
          <button type="button" onClick={fromDate}
            className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)]">Convert</button>
        </div>
      </div>
    </div>
  );
}

function RegexTool() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [input, setInput] = useState("");

  let regex: RegExp | null = null;
  let regexError = "";
  try { regex = pattern ? new RegExp(pattern, flags) : null; } catch (e) { regexError = String(e); }

  const matches: { match: string; index: number; groups?: Record<string, string> }[] = [];
  if (regex && input) {
    let m: RegExpExecArray | null;
    const r = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
    while ((m = r.exec(input)) !== null) {
      matches.push({ match: m[0], index: m.index, groups: m.groups as Record<string, string> | undefined });
      if (!flags.includes("g")) break;
    }
  }

  // Highlight matches in input
  const highlighted = (() => {
    if (!regex || !input || matches.length === 0) return null;
    const parts: { text: string; match: boolean }[] = [];
    let last = 0;
    for (const { match, index } of matches) {
      if (index > last) parts.push({ text: input.slice(last, index), match: false });
      parts.push({ text: match, match: true });
      last = index + match.length;
    }
    if (last < input.length) parts.push({ text: input.slice(last), match: false });
    return parts;
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3">
          <span className="text-[var(--muted)] font-mono text-sm select-none">/</span>
          <input value={pattern} onChange={(e) => setPattern(e.target.value)}
            placeholder="pattern" className="flex-1 bg-transparent px-1 py-1.5 font-mono text-sm outline-none" />
          <span className="text-[var(--muted)] font-mono text-sm select-none">/</span>
          <input value={flags} onChange={(e) => setFlags(e.target.value)}
            className="w-10 bg-transparent pl-1 py-1.5 font-mono text-sm outline-none text-[var(--muted)]" />
        </div>
        <span className={cn("text-xs", matches.length > 0 ? "text-green-600 dark:text-green-400" : "text-[var(--muted)]")}>
          {regex && input ? `${matches.length} match${matches.length !== 1 ? "es" : ""}` : ""}
        </span>
      </div>
      {regexError && <Err msg={regexError} />}
      <Textarea value={input} onChange={setInput} placeholder="Test input…" rows={5} />
      {highlighted && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 font-mono text-sm whitespace-pre-wrap break-all">
          {highlighted.map((p, i) =>
            p.match
              ? <mark key={i} className="rounded bg-amber-200 text-amber-900 dark:bg-amber-700 dark:text-amber-100 px-0.5">{p.text}</mark>
              : <span key={i}>{p.text}</span>
          )}
        </div>
      )}
      {matches.length > 0 && (
        <div className="space-y-1">
          {matches.slice(0, 50).map((m, i) => (
            <div key={i} className="flex items-center gap-3 rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-1 text-xs">
              <span className="text-[var(--muted)] w-6 shrink-0">#{i + 1}</span>
              <span className="font-mono text-[var(--accent)] flex-1">{JSON.stringify(m.match)}</span>
              <span className="text-[var(--muted)]">@{m.index}</span>
              {m.groups && <span className="text-[var(--muted)]">{JSON.stringify(m.groups)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffTool() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [patch, setPatch] = useState<string | null>(null);

  const compare = () => {
    const p = createTwoFilesPatch("A", "B", left, right);
    setPatch(p);
  };

  const lines = patch?.split("\n") ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">Original</p>
          <Textarea value={left} onChange={setLeft} placeholder="Original text…" rows={7} />
        </div>
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">Modified</p>
          <Textarea value={right} onChange={setRight} placeholder="Modified text…" rows={7} />
        </div>
      </div>
      <button type="button" onClick={compare}
        className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)]">
        Compare
      </button>
      {patch && (
        <div className="overflow-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 font-mono text-xs max-h-80">
          {lines.slice(3).map((line, i) => (
            <div key={i} className={cn(
              "whitespace-pre",
              line.startsWith("+") && "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300",
              line.startsWith("-") && "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
              line.startsWith("@@") && "text-blue-600 dark:text-blue-400",
            )}>{line || " "}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function BaseConverterTool() {
  const [input, setInput] = useState("");
  const [fromBase, setFromBase] = useState(10);
  const result = input.trim() ? baseConvert(input, fromBase, [2, 8, 10, 16]) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-[var(--muted)]">Input base</label>
        {([2, 8, 10, 16] as const).map((b) => (
          <button key={b} type="button" onClick={() => setFromBase(b)}
            className={cn("rounded px-2 py-0.5 text-xs border", fromBase === b ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]" : "border-[var(--border)]")}>
            {b === 2 ? "bin" : b === 8 ? "oct" : b === 10 ? "dec" : "hex"}
          </button>
        ))}
      </div>
      <input value={input} onChange={(e) => setInput(e.target.value)}
        placeholder={fromBase === 16 ? "e.g. 1A3F" : fromBase === 2 ? "e.g. 1010" : "e.g. 255"}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]" />
      {result && Object.keys(result).length > 0 ? (
        <>
          {result.binary !== undefined && <Field label="Binary (2)" value={result.binary} />}
          {result.octal !== undefined && <Field label="Octal (8)" value={result.octal} />}
          {result.decimal !== undefined && <Field label="Decimal (10)" value={result.decimal} />}
          {result.hex !== undefined && <Field label="Hex (16)" value={result.hex} />}
        </>
      ) : input ? <Err msg="Invalid input for selected base" /> : null}
    </div>
  );
}

function ColorTool() {
  const [hex, setHex] = useState("#3b82f6");
  const rgb = hexToRgb(hex);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;

  const fromRgb = (r: number, g: number, b: number) => {
    setHex(`#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input type="color" value={hex} onChange={(e) => setHex(e.target.value)}
          className="h-10 w-16 cursor-pointer rounded border border-[var(--border)]" />
        <input value={hex} onChange={(e) => setHex(e.target.value)}
          className="w-28 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 font-mono text-sm outline-none" />
        {rgb && <span className="text-sm text-[var(--muted)]">rgb({rgb.r}, {rgb.g}, {rgb.b})</span>}
        {hsl && <span className="text-sm text-[var(--muted)]">hsl({hsl[0]}, {hsl[1]}%, {hsl[2]}%)</span>}
      </div>
      {rgb && (
        <>
          <div className="h-16 rounded-xl border border-[var(--border)]" style={{ backgroundColor: hex }} />
          <Field label="HEX" value={hex.toUpperCase()} />
          <Field label="RGB" value={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`} />
          <Field label="RGB (0–1)" value={`${(rgb.r / 255).toFixed(3)}, ${(rgb.g / 255).toFixed(3)}, ${(rgb.b / 255).toFixed(3)}`} />
          {hsl && <Field label="HSL" value={`hsl(${hsl[0]}deg, ${hsl[1]}%, ${hsl[2]}%)`} />}
          <Field label="Tailwind-style" value={`rgb(${rgb.r} ${rgb.g} ${rgb.b})`} />
          <div className="grid grid-cols-5 gap-1">
            {[90, 70, 50, 30, 10].map((l) => (
              <div key={l} title={`L ${l}%`}
                style={{ backgroundColor: hsl ? `hsl(${hsl[0]},${hsl[1]}%,${l}%)` : hex }}
                className="h-8 rounded cursor-pointer border border-[var(--border)]"
                onClick={() => hsl && fromRgb(...(() => {
                  const c = `hsl(${hsl[0]},${hsl[1]}%,${l}%)`;
                  const tmp = document.createElement("canvas"); tmp.width = tmp.height = 1;
                  const ctx = tmp.getContext("2d")!; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1);
                  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                  return [r, g, b] as [number, number, number];
                })())}
              />
            ))}
          </div>
          <p className="text-[10px] text-[var(--muted)]">Shade strip — click to select</p>
        </>
      )}
    </div>
  );
}

function HttpHeadersTool() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<{ headers: Record<string, string>; status: number; statusText: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetch_ = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await fetch(`/api/tools/fetch-headers?url=${encodeURIComponent(url)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      setResult(data);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void fetch_()}
          placeholder="https://example.com"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]" />
        <button type="button" onClick={fetch_} disabled={busy || !url.trim()}
          className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50">
          {busy ? "Fetching…" : "Fetch"}
        </button>
      </div>
      {error && <Err msg={error} />}
      {result && (
        <>
          <div className={cn("rounded-lg border px-3 py-2 text-xs font-mono", result.status < 400 ? "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-300" : "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300")}>
            {result.status} {result.statusText}
          </div>
          {Object.entries(result.headers).map(([k, v]) => (
            <Field key={k} label={k} value={v} />
          ))}
        </>
      )}
    </div>
  );
}

// ── tool registry ─────────────────────────────────────────────────────────────

const TOOLS = [
  { id: "json",       label: "JSON",           icon: Braces,      category: "Format",   component: JsonTool },
  { id: "yaml",       label: "YAML ↔ JSON",    icon: FileCode2,   category: "Format",   component: YamlJsonTool },
  { id: "base64",     label: "Base64",          icon: Dna,         category: "Encode",   component: Base64Tool },
  { id: "url",        label: "URL",             icon: Link,        category: "Encode",   component: UrlTool },
  { id: "jwt",        label: "JWT Decoder",     icon: KeyRound,    category: "Encode",   component: JwtTool },
  { id: "hash",       label: "Hash",            icon: Hash,        category: "Crypto",   component: HashTool },
  { id: "uuid",       label: "UUID",            icon: Shuffle,     category: "Crypto",   component: UuidTool },
  { id: "random",     label: "Random Bytes",    icon: Binary,      category: "Crypto",   component: RandomBytesTool },
  { id: "timestamp",  label: "Timestamp",       icon: Clock,       category: "Convert",  component: TimestampTool },
  { id: "base",       label: "Base Convert",    icon: Binary,      category: "Convert",  component: BaseConverterTool },
  { id: "color",      label: "Color",           icon: Palette,     category: "Convert",  component: ColorTool },
  { id: "regex",      label: "Regex",           icon: Regex,       category: "Inspect",  component: RegexTool },
  { id: "diff",       label: "Text Diff",       icon: FileCode2,   category: "Inspect",  component: DiffTool },
  { id: "headers",    label: "HTTP Headers",    icon: Network,     category: "Network",  component: HttpHeadersTool },
] as const;

type ToolId = typeof TOOLS[number]["id"];
const CATEGORIES = ["Format", "Encode", "Crypto", "Convert", "Inspect", "Network"] as const;

// ── main panel ────────────────────────────────────────────────────────────────

export function DevToolsPanel() {
  const [active, setActive] = useState<ToolId>("json");
  const tool = TOOLS.find((t) => t.id === active)!;
  const ToolComponent = tool.component;

  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar */}
      <aside className="flex w-44 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] overflow-y-auto">
        {CATEGORIES.map((cat) => {
          const tools = TOOLS.filter((t) => t.category === cat);
          return (
            <div key={cat}>
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{cat}</p>
              {tools.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActive(t.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                    active === t.id
                      ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                      : "text-[var(--foreground)] hover:bg-[var(--border)]",
                  )}
                >
                  <t.icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  {t.label}
                  {active === t.id && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
                </button>
              ))}
            </div>
          );
        })}
      </aside>

      {/* Workspace */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
        <h2 className="mb-4 text-base font-semibold">{tool.label}</h2>
        <ToolComponent />
      </main>
    </div>
  );
}
