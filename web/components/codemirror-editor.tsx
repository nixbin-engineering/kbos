"use client";

import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

function wikilinkExtension(suggestionsRef: { current: string[] }): Extension {
  const completionSource = (ctx: CompletionContext): CompletionResult | null => {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const textBefore = line.text.slice(0, ctx.pos - line.from);
    const bracketIdx = textBefore.lastIndexOf("[[");
    if (bracketIdx === -1) return null;
    const between = textBefore.slice(bracketIdx + 2);
    if (between.includes("]]")) return null;
    const from = line.from + bracketIdx + 2;
    return {
      from,
      options: suggestionsRef.current.map((s) => {
        const label = s.replace(/\.md$/, "").split("/").pop() ?? s;
        return { label, apply: `${label}]]`, detail: s.replace(/\.md$/, "") };
      }),
      validFor: /^[^\]]*$/,
    };
  };
  return autocompletion({ override: [completionSource], closeOnBlur: true });
}

export interface CodeMirrorEditorHandle {
  scrollToLine(line: number): void;
  insertAt(offset: number, text: string): void;
  getCursorOffset(): number;
  focus(): void;
  getView(): EditorView | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onPaste?: (e: ClipboardEvent) => boolean | void;
  onDrop?: (e: DragEvent) => boolean | void;
  readOnly?: boolean;
  className?: string;
  dark?: boolean;
  wikilinkSuggestions?: string[]; // list of note titles/paths for [[ autocomplete
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, Props>(function CodeMirrorEditor(
  { value, onChange, onPaste, onDrop, readOnly = false, className = "", dark = false, wikilinkSuggestions = [] },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const externalValue = useRef(value);
  const suggestionsRef = useRef(wikilinkSuggestions);
  suggestionsRef.current = wikilinkSuggestions;

  useImperativeHandle(ref, () => ({
    scrollToLine(line: number) {
      const view = viewRef.current;
      if (!view) return;
      const lineObj = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines)));
      view.dispatch({ effects: EditorView.scrollIntoView(lineObj.from, { y: "start" }) });
    },
    insertAt(offset: number, text: string) {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        changes: { from: offset, to: offset, insert: text },
        selection: { anchor: offset + text.length },
      });
    },
    getCursorOffset() {
      return viewRef.current?.state.selection.main.head ?? 0;
    },
    focus() {
      viewRef.current?.focus();
    },
    getView() {
      return viewRef.current;
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newVal = update.state.doc.toString();
        externalValue.current = newVal;
        onChange(newVal);
      }
    });

    const pasteHandler = EditorView.domEventHandlers({
      paste(e) {
        return onPaste?.(e) ?? false;
      },
      drop(e) {
        return onDrop?.(e) ?? false;
      },
    });

    const baseTheme = EditorView.theme({
      "&": { height: "100%", fontSize: "0.875rem" },
      ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, monospace", lineHeight: "1.75" },
      ".cm-content": { padding: "1rem" },
      ".cm-line": { padding: "0 0.5rem" },
      ".cm-gutters": { borderRight: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--muted)" },
      ".cm-activeLineGutter": { backgroundColor: "transparent" },
      ".cm-activeLine": { backgroundColor: "var(--accent-subtle, rgba(99,102,241,0.06))" },
      ".cm-cursor": { borderLeftColor: "var(--foreground)" },
      ".cm-selectionBackground": { backgroundColor: "var(--accent-subtle, rgba(99,102,241,0.15)) !important" },
      ".cm-search": { padding: "4px 8px", display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" },
      ".cm-search input": { border: "1px solid var(--border)", borderRadius: "4px", padding: "2px 6px", background: "var(--background)", color: "var(--foreground)", fontSize: "0.8rem" },
      ".cm-search button": { border: "1px solid var(--border)", borderRadius: "4px", padding: "2px 6px", background: "var(--panel)", color: "var(--foreground)", cursor: "pointer", fontSize: "0.8rem" },
      ".cm-search button:hover": { background: "var(--border)" },
      ".cm-searchMatch": { backgroundColor: "var(--accent-subtle, rgba(99,102,241,0.25))", outline: "1px solid var(--accent)" },
      ".cm-searchMatch-selected": { backgroundColor: "var(--accent)", color: "var(--accent-fg)" },
    });

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      drawSelection(),
      dropCursor(),
      history(),
      search({ top: false }),
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      wikilinkExtension(suggestionsRef),
      updateListener,
      pasteHandler,
      baseTheme,
      EditorState.readOnly.of(readOnly),
      placeholder("Start writing…"),
      ...(dark ? [oneDark] : []),
    ];

    const state = EditorState.create({ doc: value, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, readOnly]);

  // Sync external value changes (new doc loaded) without resetting history
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === externalValue.current) return;
    externalValue.current = value;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      // Don't add to undo history — this is an external load
      annotations: [],
    });
  }, [value]);

  return <div ref={containerRef} className={`h-full min-h-0 ${className}`} />;
});
