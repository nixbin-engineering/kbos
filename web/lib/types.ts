export type TreeNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
  encrypted?: boolean;
};

export type DocMeta = {
  title?: string;
  tags?: string[];
  aliases?: string[];
  status?: string;
  created?: string;
  updated?: string;
};

export type DocResponse = {
  path: string;
  meta: DocMeta;
  body: string;
  raw: string;
  encrypted?: boolean;
};

export type SearchHit = {
  path: string;
  title: string;
  snippet: string;
};

export type TemplateEntry = {
  path: string;
  name: string;
  category: string;
};

export type CreateKind = "note" | "folder" | "template" | "drawing";

export type FolderIndexEntry = {
  path: string;
  name: string;
  title: string;
  type: "file" | "dir";
  snippet?: string;
};

export type FolderIndex = {
  folder: string;
  folderTitle: string;
  indexPath: string | null;
  indexDoc: DocResponse | null;
  entries: FolderIndexEntry[];
};

export type AISettings = {
  enabled: boolean;
  provider: "ollama" | "openai_compatible";
  base_url: string;
  model: string;
  embed_model?: string;
};

export type UISettings = {
  autosave_seconds: number;
  attachments_subdir: string;
  default_theme?: ThemeId;
};

export type ThemeId = "light" | "dark" | "auto" | "nord" | "dracula" | "solarized";

export type LinkRef = {
  path: string;
  title: string;
  target: string;
  broken?: boolean;
};

export type GraphNode = {
  id: string;
  title: string;
  folder: string;
  tags: string[];
};

export type GraphEdge = {
  from: string;
  to: string;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type TaskItem = {
  path: string;
  title: string;
  line: number;
  text: string;
  done: boolean;
};

export type Tab = {
  id: string;
  path: string | null;
  folderView: string | null;
};
