import { create } from 'zustand';
import type { DirEntry } from '@/host/fs';
import { getFS } from '@/host/fs';

export interface TreeNode {
  entry: DirEntry;
  children?: TreeNode[];
  expanded?: boolean;
}

interface WorkspaceState {
  root: string | null;
  tree: TreeNode[];
  loading: boolean;
  setRoot: (root: string | null) => void;
  openFolder: () => Promise<void>;
  refreshTree: () => Promise<void>;
  toggleExpand: (path: string) => void;
  getAllFilePaths: () => string[];
}

function setExpanded(nodes: TreeNode[], path: string): TreeNode[] {
  return nodes.map((n) => {
    if (n.entry.path === path) return { ...n, expanded: !n.expanded };
    if (n.children) return { ...n, children: setExpanded(n.children, path) };
    return n;
  });
}

async function buildTree(path: string): Promise<TreeNode[]> {
  const fs = await getFS();
  const entries = await fs.listDir(path);
  return entries.map((entry) => ({
    entry,
    expanded: false,
    children: entry.isDirectory ? undefined : undefined,
  }));
}

async function loadChildren(node: TreeNode): Promise<TreeNode[]> {
  if (!node.entry.isDirectory) return [];
  const fs = await getFS();
  const entries = await fs.listDir(node.entry.path);
  return entries.map((entry) => ({ entry, expanded: false }));
}

function collectPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = [];
  for (const n of nodes) {
    if (!n.entry.isDirectory) paths.push(n.entry.path);
    if (n.children) paths.push(...collectPaths(n.children));
  }
  return paths;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  root: null,
  tree: [],
  loading: false,

  setRoot: (root) => set({ root }),

  openFolder: async () => {
    set({ loading: true });
    try {
      const fs = await getFS();
      const root = await fs.openFolder();
      if (root) {
        const tree = await buildTree(root);
        set({ root, tree });
      }
    } finally {
      set({ loading: false });
    }
  },

  refreshTree: async () => {
    const { root } = get();
    if (!root) return;
    set({ loading: true });
    try {
      const tree = await buildTree(root);
      set({ tree });
    } finally {
      set({ loading: false });
    }
  },

  toggleExpand: async (path) => {
    const { tree } = get();
    const toggle = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
      const result: TreeNode[] = [];
      for (const n of nodes) {
        if (n.entry.path === path && n.entry.isDirectory) {
          const expanded = !n.expanded;
          const children = expanded && !n.children ? await loadChildren(n) : n.children;
          result.push({ ...n, expanded, children });
        } else if (n.children) {
          result.push({ ...n, children: await toggle(n.children) });
        } else {
          result.push(n);
        }
      }
      return result;
    };
    set({ tree: await toggle(tree) });
  },

  getAllFilePaths: () => collectPaths(get().tree),
}));
