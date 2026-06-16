"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, Bot, CheckSquare, FilePlus, GitBranch, KeyRound, Link2, Menu, RefreshCw, Settings, Wrench } from "lucide-react";
import type { Tab, TreeNode } from "@/lib/types";
import { useVaultEvents } from "@/lib/use-vault-events";
import { AdminSettingsButton } from "./admin-settings";
import { TabBar } from "./tab-bar";
import { Tooltip } from "./tooltip";
import { AiChatPanel, type ChatScope } from "./ai-chat-panel";
import { BookmarksManager } from "./bookmarks-manager";
import { CommandPalette } from "./command-palette";
import { DocWorkspace } from "./doc-workspace";
import { FolderIndexView } from "./folder-index-view";
import { GraphPanel } from "./graph-panel";
import { JournalMenu } from "./journal-menu";
import { LoginForm } from "./login-form";
import { PdfViewer } from "./pdf-viewer";
import { SearchPanel } from "./search-panel";
import { SetupWizard } from "./setup-wizard";
import { TagExplorer } from "./tag-explorer";
import { TasksManager } from "./tasks-manager";
import { TasksPanel } from "./tasks-panel";
import { UserMenu } from "./user-menu";
import { VaultTree } from "./vault-tree";
import { DevToolsPanel } from "./dev-tools-panel";
import { ResizableSplit } from "./resizable-split";
import { VaultSwitcher } from "./vault-switcher";
import { PasswordManager } from "./password-manager";
import { DashboardView } from "./dashboard-view";

type Phase = "loading" | "setup" | "login" | "app";

function findFileInTree(tree: TreeNode | null, relPath: string): boolean {
  if (!tree?.children) return false;
  const walk = (nodes: TreeNode[]): boolean => {
    for (const n of nodes) {
      if (n.type === "file" && n.path === relPath) return true;
      if (n.type === "dir" && n.children && walk(n.children)) return true;
    }
    return false;
  };
  return walk(tree.children);
}

export function KbosShell() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<string | null>(null);
  const [userRole, setUserRole] = useState("guest");
  const [autosaveSeconds, setAutosaveSeconds] = useState(5);
  const [startPage, setStartPage] = useState("home.md");
  const [tagRefreshKey, setTagRefreshKey] = useState(0);
  const [liveDocTags, setLiveDocTags] = useState<string[]>([]);
  const [docRemoteRev, setDocRemoteRev] = useState<{ path: string; nonce: number } | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([{ id: "tab-1", path: null, folderView: null }]);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitPath, setSplitPath] = useState<string | null>(null);
  const [splitFolderView, setSplitFolderView] = useState<string | null>(null);
  const [syncScroll, setSyncScroll] = useState(false);
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncing = useRef(false);
  const [tagQuery, setTagQuery] = useState<string | null>(null);

  const selected = tabs[activeTabIdx]?.path ?? null;
  const folderView = tabs[activeTabIdx]?.folderView ?? null;

  // Sync scroll between split panes
  useEffect(() => {
    if (!syncScroll || !splitEnabled) return;
    const left = leftScrollRef.current;
    const right = rightScrollRef.current;
    if (!left || !right) return;
    const onLeftScroll = () => {
      if (scrollSyncing.current) return;
      scrollSyncing.current = true;
      const pct = left.scrollTop / (left.scrollHeight - left.clientHeight || 1);
      right.scrollTop = pct * (right.scrollHeight - right.clientHeight);
      scrollSyncing.current = false;
    };
    const onRightScroll = () => {
      if (scrollSyncing.current) return;
      scrollSyncing.current = true;
      const pct = right.scrollTop / (right.scrollHeight - right.clientHeight || 1);
      left.scrollTop = pct * (left.scrollHeight - left.clientHeight);
      scrollSyncing.current = false;
    };
    left.addEventListener("scroll", onLeftScroll, { passive: true });
    right.addEventListener("scroll", onRightScroll, { passive: true });
    return () => {
      left.removeEventListener("scroll", onLeftScroll);
      right.removeEventListener("scroll", onRightScroll);
    };
  }, [syncScroll, splitEnabled]);

  let tabIdCounter = useRef(2);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiInitialScope, setAiInitialScope] = useState<ChatScope | undefined>();
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>();
  const [graphOpen, setGraphOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);       // mobile overlay
  const [desktopSidebar, setDesktopSidebar] = useState(true);  // desktop persistent
  const [appView, setAppView] = useState<"notes" | "tasks" | "bookmarks" | "passwords" | "tools">("notes");
  const [templatePick, setTemplatePick] = useState<{ path: string } | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);

  const initialNavDone = useRef(false);
  const startPageRef = useRef("home.md");

  // Navigation history (per active tab — stored alongside tab state via refs)
  type NavEntry = { path: string | null; folderView: string | null };
  const navHistory = useRef<NavEntry[]>([]);
  const navIdx = useRef(-1);
  const [navCanBack, setNavCanBack] = useState(false);
  const [navCanForward, setNavCanForward] = useState(false);

  const updateNavState = useCallback(() => {
    setNavCanBack(navIdx.current > 0);
    setNavCanForward(navIdx.current < navHistory.current.length - 1);
  }, []);

  const checkAuth = useCallback(async () => {
    const setup = await fetch("/api/setup/status").then((r) => r.json());
    if (setup.required) {
      setPhase("setup");
      return false;
    }
    const me = await fetch("/api/auth/me").then((r) => r.json());
    if (me.required && !me.user) {
      setPhase("login");
      return false;
    }
    setUser(me.user || null);
    setUserRole(me.role || "guest");
    setPhase("app");
    return true;
  }, []);

  const loadTree = useCallback(async () => {
    setError(null);
    try {
      const health = await fetch("/api/health");
      if (!health.ok) {
        setReady(false);
        setError("Vault initializing… retry in a few seconds.");
        return;
      }
      const r = await fetch("/api/tree");
      if (r.status === 401) {
        setPhase("login");
        return;
      }
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      const treeData = await r.json();
      setTree(treeData);
      setReady(true);
      // On first load: fetch settings to get configured start page, then open it
      if (!initialNavDone.current) {
        initialNavDone.current = true;
        try {
          const sr = await fetch("/api/settings");
          if (sr.ok) {
            const s = await sr.json();
            if (s?.ui?.autosave_seconds) setAutosaveSeconds(s.ui.autosave_seconds);
            if (s?.ui?.start_page) { setStartPage(s.ui.start_page); startPageRef.current = s.ui.start_page; }
          }
        } catch { /* ignore */ }
        // Check for ?doc= deep link first, fall back to configured start page
        const docParam = typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("doc")
          : null;
        if (docParam && findFileInTree(treeData, docParam)) {
          setTabs((prev) => prev.map((t, i) => i === 0 ? { ...t, path: docParam } : t));
          window.history.replaceState({}, "", window.location.pathname);
        } else {
          const sp = startPageRef.current;
          if (sp && findFileInTree(treeData, sp)) {
            setTabs((prev) => prev.map((t, i) => i === 0 ? { ...t, path: sp } : t));
          }
          // sp === "" means user wants the dashboard (no doc on load)
        }
      }
    } catch (e) {
      setError(String(e));
      setReady(false);
    }
  }, []);

  useEffect(() => {
    checkAuth().then((ok) => {
      if (ok) loadTree();
    });
  }, [checkAuth, loadTree]);

  useEffect(() => {
    if (phase !== "app") return;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.ui?.autosave_seconds) setAutosaveSeconds(s.ui.autosave_seconds);
        if (s?.ui?.start_page) { setStartPage(s.ui.start_page); startPageRef.current = s.ui.start_page; }
      })
      .catch(() => undefined);
  }, [phase]);

  const onDocumentSaved = useCallback(() => {
    loadTree();
    setTagRefreshKey((k) => k + 1);
  }, [loadTree]);

  useVaultEvents(phase === "app", {
    onTree: loadTree,
    onTags: () => setTagRefreshKey((k) => k + 1),
    onDoc: (path) => {
      loadTree();
      setTagRefreshKey((k) => k + 1);
      setDocRemoteRev({ path, nonce: Date.now() });
    },
  });

  const pushNav = useCallback((entry: NavEntry) => {
    navHistory.current = navHistory.current.slice(0, navIdx.current + 1);
    navHistory.current.push(entry);
    navIdx.current = navHistory.current.length - 1;
    updateNavState();
  }, [updateNavState]);

  const setActiveTab = useCallback((update: Partial<Pick<Tab, "path" | "folderView">>) => {
    setTabs((prev) => prev.map((t, i) => i === activeTabIdx ? { ...t, ...update } : t));
  }, [activeTabIdx]);

  const openDoc = useCallback((path: string) => {
    setActiveTab({ path, folderView: null });
    setAppView("notes");
    pushNav({ path, folderView: null });
    setSidebarOpen(false);
  }, [setActiveTab, pushNav]);

  const openDocNewTab = useCallback((path: string) => {
    const id = `tab-${tabIdCounter.current++}`;
    setTabs((prev) => [...prev, { id, path, folderView: null }]);
    setActiveTabIdx((prev) => prev + 1); // will be the new last tab
    setAppView("notes");
    setSidebarOpen(false);
  }, []);

  const openDocInSplit = useCallback((path: string) => {
    setSplitPath(path);
    setSplitFolderView(null);
    setSplitEnabled(true);
  }, []);

  const openFolder = useCallback(
    (folderPath: string) => {
      const indexPath = folderPath ? `${folderPath}/index.md` : "index.md";
      if (findFileInTree(tree, indexPath)) {
        setActiveTab({ path: indexPath, folderView: null });
        pushNav({ path: indexPath, folderView: null });
      } else {
        setActiveTab({ path: null, folderView: folderPath });
        pushNav({ path: null, folderView: folderPath });
      }
    },
    [tree, setActiveTab, pushNav],
  );

  const navBack = useCallback(() => {
    if (navIdx.current <= 0) return;
    navIdx.current -= 1;
    const { path, folderView: f } = navHistory.current[navIdx.current];
    setActiveTab({ path, folderView: f });
    updateNavState();
  }, [setActiveTab, updateNavState]);

  const navForward = useCallback(() => {
    if (navIdx.current >= navHistory.current.length - 1) return;
    navIdx.current += 1;
    const { path, folderView: f } = navHistory.current[navIdx.current];
    setActiveTab({ path, folderView: f });
    updateNavState();
  }, [setActiveTab, updateNavState]);

  const closeTab = useCallback((idx: number) => {
    setTabs((prev) => {
      if (prev.length === 1) return [{ id: `tab-${tabIdCounter.current++}`, path: null, folderView: null }];
      return prev.filter((_, i) => i !== idx);
    });
    setActiveTabIdx((prev) => {
      if (idx < prev) return prev - 1;
      if (idx === prev) return Math.max(0, prev - 1);
      return prev;
    });
  }, []);

  const newTab = useCallback(() => {
    const id = `tab-${tabIdCounter.current++}`;
    setTabs((prev) => [...prev, { id, path: null, folderView: null }]);
    setActiveTabIdx((prev) => tabs.length); // new tab is at end
  }, [tabs.length]);

  const activateTab = useCallback((idx: number) => {
    setActiveTabIdx(idx);
    navHistory.current = [];
    navIdx.current = -1;
    updateNavState();
  }, [updateNavState]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setPhase("login");
  };

  const openAiChat = useCallback((opts?: { scope?: ChatScope; prompt?: string }) => {
    setAiInitialScope(opts?.scope);
    setAiInitialPrompt(opts?.prompt);
    setAiChatOpen(true);
  }, []);

  const createFromTemplate = useCallback(async () => {
    if (!templatePick || !templateName.trim()) return;
    setTemplateBusy(true);
    try {
      const baseName = templateName.trim().replace(/\.md$/, "");
      const folder = folderView ?? (selected?.includes("/") ? selected.slice(0, selected.lastIndexOf("/")) : "");
      const rel = folder ? `${folder}/${baseName}` : baseName;
      const r = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: rel, template: templatePick.path }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      await loadTree();
      openDoc(data.path);
      setTemplatePick(null);
      setTemplateName("");
    } finally {
      setTemplateBusy(false);
    }
  }, [templatePick, templateName, folderView, selected, loadTree, openDoc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        openAiChat();
      }
      if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); navBack(); }
      if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); navForward(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAiChat, navBack, navForward]);

  const createFolderIndex = useCallback(async () => {
    if (folderView === null) return;
    const rel = folderView ? `${folderView}/index` : "index";
    const r = await fetch("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: rel }),
    });
    if (r.ok) {
      const doc = await r.json();
      await loadTree();
      openDoc(doc.path);
    }
  }, [folderView, loadTree, openDoc]);

  const renderDocPane = useCallback(
    (panePath: string | null, paneFolderView: string | null, opts?: { isSplit?: boolean }) => {
      const onOpen = opts?.isSplit ? openDocInSplit : openDoc;
      const onOpenFld = opts?.isSplit
        ? (fp: string) => { setSplitFolderView(fp); setSplitPath(null); }
        : openFolder;
      if (panePath?.endsWith(".pdf")) {
        return <PdfViewer filePath={panePath} fileName={panePath.split("/").pop()} />;
      }
      if (paneFolderView !== null && panePath === null) {
        return (
          <FolderIndexView
            folderPath={paneFolderView}
            tree={tree}
            refreshKey={tagRefreshKey}
            onOpenDoc={onOpen}
            onOpenFolder={onOpenFld}
            onCreateIndex={createFolderIndex}
            onAskAi={() =>
              openAiChat({ scope: "folder", prompt: "Summarize this folder and suggest related notes or tags" })
            }
          />
        );
      }
      return (
        <DocWorkspace
          path={panePath}
          tree={tree}
          autosaveSeconds={autosaveSeconds}
          docRemoteRev={panePath && docRemoteRev?.path === panePath ? docRemoteRev : null}
          onOpenDoc={onOpen}
          onOpenFolder={onOpenFld}
          onSaved={onDocumentSaved}
          onLiveTagsChange={opts?.isSplit ? undefined : setLiveDocTags}
          onAskAi={(prompt) =>
            openAiChat({ scope: panePath ? "document" : paneFolderView !== null ? "folder" : "vault", prompt })
          }
          scrollRef={opts?.isSplit ? rightScrollRef : leftScrollRef}
        />
      );
    },
    [openDoc, openDocInSplit, openFolder, tree, tagRefreshKey, autosaveSeconds, docRemoteRev, onDocumentSaved, createFolderIndex, openAiChat],
  );

  const toolbarBtn = () =>
    "flex items-center justify-center rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]";

  if (phase === "loading") {
    return (
      <div className="flex h-screen flex-col">
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2">
          <div className="h-5 w-5 animate-pulse rounded bg-[var(--border)]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
          <div className="ml-auto flex gap-2">
            {[40, 56, 48, 32, 32].map((w, i) => (
              <div key={i} className="h-7 animate-pulse rounded bg-[var(--border)]" style={{ width: w }} />
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="w-72 shrink-0 border-r border-[var(--border)] bg-[var(--panel)] p-3 space-y-2">
            <div className="h-8 animate-pulse rounded bg-[var(--border)]" />
            {[80, 60, 90, 50, 70, 65, 55, 75].map((w, i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-[var(--border)]" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="flex-1 p-8 space-y-3">
            <div className="h-6 w-1/3 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-4 w-full animate-pulse rounded bg-[var(--border)]" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-[var(--border)]" />
          </div>
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <SetupWizard
        onComplete={async () => {
          await checkAuth();
          await loadTree();
        }}
      />
    );
  }

  if (phase === "login") {
    return (
      <LoginForm
        onLoggedIn={async () => {
          await checkAuth();
          await loadTree();
        }}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--panel)]/95 backdrop-blur-sm px-3 py-2 shadow-sm relative z-10">
        {/* Left: branding + nav */}
        <div className="flex items-center gap-1">
          <Tooltip content="Toggle sidebar" side="bottom">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth >= 768) {
                  setDesktopSidebar((v) => !v);
                } else {
                  setSidebarOpen((v) => !v);
                }
              }}
              className={toolbarBtn()}
            >
              <Menu className="h-4 w-4" />
            </button>
          </Tooltip>
          <div className="flex items-center gap-1.5 px-1">
            <BookOpen className="h-4 w-4 text-[var(--accent)]" />
            <span className="hidden text-sm font-semibold sm:block">KBOS</span>
          </div>
          <div className="mx-0.5 h-5 w-px bg-[var(--border)]" />
          <VaultSwitcher
            isAdmin={userRole === "admin"}
            onSwitch={() => { void loadTree(); }}
          />
          <div className="mx-0.5 h-5 w-px bg-[var(--border)]" />
          <Tooltip content="Back (Alt+←)" side="bottom">
            <button type="button" onClick={navBack} disabled={!navCanBack}
              className={`${toolbarBtn()} disabled:opacity-30 disabled:cursor-not-allowed`}>
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="Forward (Alt+→)" side="bottom">
            <button type="button" onClick={navForward} disabled={!navCanForward}
              className={`${toolbarBtn()} disabled:opacity-30 disabled:cursor-not-allowed`}>
              <ArrowRight className="h-4 w-4" />
            </button>
          </Tooltip>
          <div className="mx-0.5 h-5 w-px bg-[var(--border)]" />
          <Tooltip content="New note (Ctrl+K → New)" side="bottom">
            <button type="button"
              onClick={() => setPaletteOpen(true)}
              className={toolbarBtn()}>
              <FilePlus className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>

        {/* Center: view switcher — hidden on mobile (use bottom nav instead) */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--background)] p-0.5 gap-0.5">
            {([
              ["notes", BookOpen, "Notes"],
              ["tasks", CheckSquare, "Tasks"],
              ["bookmarks", Bookmark, "Bookmarks"],
              ["passwords", KeyRound, "Passwords"],
              ["tools", Wrench, "Dev Tools"],
            ] as const).map(([view, Icon, label]) => (
              <Tooltip key={view} content={label} side="bottom">
                <button
                  type="button"
                  onClick={() => setAppView(view)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                    appView === view
                      ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm"
                      : "text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
        {/* Mobile: show current view label */}
        <div className="flex flex-1 items-center justify-center md:hidden">
          <span className="text-sm font-semibold capitalize text-[var(--foreground)]">
            {appView === "notes" && selected === null && folderView === null ? "Home" : appView === "notes" ? (selected?.split("/").pop()?.replace(/\.md$/, "") ?? "Notes") : appView}
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-0.5">
          <Tooltip content="Daily journal" side="bottom">
            <span className="hidden md:inline"><JournalMenu onOpenDoc={openDoc} iconOnly /></span>
          </Tooltip>
          <Tooltip content="Knowledge graph" side="bottom">
            <button type="button" onClick={() => setGraphOpen(true)} className={`${toolbarBtn()} hidden md:flex`}>
              <GitBranch className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="Command palette (Ctrl+K)" side="bottom">
            <button type="button" onClick={() => setPaletteOpen(true)} className={`${toolbarBtn()} hidden md:flex`}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
              </svg>
            </button>
          </Tooltip>
          <div className="mx-1 hidden h-5 w-px bg-[var(--border)] md:block" />
          {/* Ask AI hidden on mobile — in bottom nav instead */}
          <Tooltip content="KB Assistant (Ctrl+Shift+A)" side="bottom">
            <button
              type="button"
              onClick={() => openAiChat()}
              className="hidden md:flex items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>
          </Tooltip>
          <div className="mx-1 hidden h-5 w-px bg-[var(--border)] md:block" />
          <Tooltip content="Refresh vault" side="bottom">
            <button type="button" onClick={loadTree} className={`${toolbarBtn()} hidden md:flex`}>
              <RefreshCw className="h-4 w-4" />
            </button>
          </Tooltip>
          {userRole === "admin" && (
            <Tooltip content="Settings" side="bottom">
              <span>
                <AdminSettingsButton
                  role={userRole}
                  autosaveSeconds={autosaveSeconds}
                  onUpdated={setAutosaveSeconds}
                  iconOnly
                />
              </span>
            </Tooltip>
          )}
          <UserMenu user={user} onLogout={logout} />
        </div>
      </header>

      {!ready && error && (
        <div className="bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">{error}</div>
      )}

      <div className="flex min-h-0 flex-1 pb-[env(safe-area-inset-bottom)] md:pb-0">
        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside className={`kbos-sidebar flex min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r border-[var(--border)] ${sidebarOpen ? "fixed inset-y-0 left-0 z-30 flex" : desktopSidebar ? "hidden md:flex" : "hidden"}`}>
          <SearchPanel
            searchInputId="vault-search"
            onOpen={openDoc}
            tagQuery={tagQuery}
            onTagQueryHandled={() => setTagQuery(null)}
          />
          {/* Section label */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Notes</span>
          </div>
          <VaultTree
            tree={tree}
            selected={selected}
            folderView={folderView}
            onSelect={openDoc}
            onSelectFolder={openFolder}
            onCreated={openDoc}
            onDeleted={(path) => {
              setTabs((prev) =>
                prev.map((t) => {
                  const pathMatch = t.path === path || t.path?.startsWith(`${path}/`);
                  const folderMatch = t.folderView === path || t.folderView?.startsWith(`${path}/`);
                  if (pathMatch || folderMatch) return { ...t, path: null, folderView: null };
                  return t;
                }),
              );
              if (splitPath === path || splitPath?.startsWith(`${path}/`)) setSplitPath(null);
            }}
            onTreeRefresh={loadTree}
            onOpenDoc={openDoc}
            onOpenDocNewTab={openDocNewTab}
            onOpenDocInSplit={openDocInSplit}
          />
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--background)]">
          {appView === "tools" ? (
            <DevToolsPanel />
          ) : appView === "passwords" ? (
            <PasswordManager />
          ) : appView === "bookmarks" ? (
            <BookmarksManager />
          ) : appView === "tasks" ? (
            <TasksManager />
          ) : selected === null && folderView === null && !splitEnabled ? (
            <DashboardView
              tree={tree}
              onOpenDoc={openDoc}
              onOpenSearch={() => { /* focus search */ document.getElementById("vault-search")?.focus(); }}
              onNewNote={() => setPaletteOpen(true)}
              onOpenJournal={async () => {
                const r = await fetch("/api/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period: "daily" }) });
                const data = await r.json();
                if (r.ok && data.path) openDoc(data.path);
              }}
              onOpenBookmarks={() => setAppView("bookmarks")}
              onOpenTasks={() => setAppView("tasks")}
            />
          ) : (
            <>
              <div className="hidden md:block">
                <TabBar
                  tabs={tabs}
                  activeIdx={activeTabIdx}
                  splitEnabled={splitEnabled}
                  onActivate={activateTab}
                  onClose={closeTab}
                  onNewTab={newTab}
                  onToggleSplit={() => setSplitEnabled((v) => !v)}
                />
              </div>
              {splitEnabled ? (
                <>
                  <div className="flex items-center justify-end border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1">
                    <button
                      type="button"
                      onClick={() => setSyncScroll((v) => !v)}
                      title={syncScroll ? "Disable scroll sync" : "Sync scroll between panes"}
                      className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                        syncScroll
                          ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                          : "text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Sync scroll
                    </button>
                  </div>
                  <ResizableSplit
                    left={renderDocPane(selected, folderView)}
                    right={renderDocPane(splitPath, splitFolderView, { isSplit: true })}
                  />
                </>
              ) : (
                renderDocPane(selected, folderView)
              )}
            </>
          )}
        </main>
        <AiChatPanel
          open={aiChatOpen}
          onClose={() => {
            setAiChatOpen(false);
            setAiInitialPrompt(undefined);
            setAiInitialScope(undefined);
          }}
          onOpenDoc={openDoc}
          selectedDoc={selected}
          folderView={folderView}
          initialScope={aiInitialScope}
          initialPrompt={aiInitialPrompt}
        />
        <GraphPanel
          open={graphOpen}
          onClose={() => setGraphOpen(false)}
          onOpenDoc={openDoc}
          centerPath={selected}
        />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          tree={tree}
          onOpenDoc={openDoc}
          onOpenFolder={openFolder}
          onOpenGraph={() => setGraphOpen(true)}
          onOpenAiChat={openAiChat}
          onOpenJournal={async () => {
            const r = await fetch("/api/journal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ period: "daily" }),
            });
            const data = await r.json();
            if (r.ok && data.path) openDoc(data.path);
          }}
          onNewFromTemplate={(tplPath) => {
            setTemplatePick({ path: tplPath });
            setTemplateName("");
          }}
        />

        {/* Template name modal */}
        {templatePick && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 shadow-lg">
              <h2 className="mb-1 font-semibold">New note from template</h2>
              <p className="mb-3 text-xs text-[var(--muted)]">{templatePick.path}</p>
              <input
                type="text"
                autoFocus
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void createFromTemplate(); if (e.key === "Escape") setTemplatePick(null); }}
                placeholder="Note name…"
                className="mb-3 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setTemplatePick(null)} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]">Cancel</button>
                <button
                  type="button"
                  disabled={templateBusy || !templateName.trim()}
                  onClick={() => void createFromTemplate()}
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent-fg)] disabled:opacity-50"
                >
                  {templateBusy ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center border-t border-[var(--border)] bg-[var(--panel)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {([
          ["notes", BookOpen, "Notes"],
          ["tasks", CheckSquare, "Tasks"],
          ["bookmarks", Bookmark, "Bookmarks"],
          ["passwords", KeyRound, "Passwords"],
        ] as const).map(([view, Icon, label]) => (
          <button
            key={view}
            type="button"
            onClick={() => setAppView(view)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              appView === view
                ? "text-[var(--accent)]"
                : "text-[var(--muted)]"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => openAiChat()}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
            aiChatOpen ? "text-[var(--accent)]" : "text-[var(--muted)]"
          }`}
        >
          <Bot className="h-5 w-5" />
          AI
        </button>
      </nav>
    </div>
  );
}
