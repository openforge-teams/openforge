import { create } from 'zustand';

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  content: string;
  language: string;
  dirty: boolean;
  cursorLine: number;
  cursorColumn: number;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  ghostText: string | null;
  inlineEditOpen: boolean;
  inlineEditPrompt: string;
  inlineEditPreview: { original: string; modified: string } | null;
  diffModal: { title: string; original: string; modified: string; onAccept?: () => void } | null;
  openTab: (tab: Omit<EditorTab, 'dirty' | 'cursorLine' | 'cursorColumn'>) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  setCursor: (id: string, line: number, column: number) => void;
  markClean: (id: string) => void;
  setGhostText: (text: string | null) => void;
  setInlineEditOpen: (open: boolean) => void;
  setInlineEditPrompt: (prompt: string) => void;
  setInlineEditPreview: (preview: { original: string; modified: string } | null) => void;
  setDiffModal: (modal: EditorState['diffModal']) => void;
  getActiveTab: () => EditorTab | undefined;
}

const langMap: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  rs: 'rust',
  py: 'python',
  go: 'go',
};

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return langMap[ext] ?? 'plaintext';
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  ghostText: null,
  inlineEditOpen: false,
  inlineEditPrompt: '',
  inlineEditPreview: null,
  diffModal: null,

  openTab: (tab) => {
    const existing = get().tabs.find((t) => t.path === tab.path);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const language = tab.language || detectLanguage(tab.path);
    set((s) => ({
      tabs: [
        ...s.tabs,
        { ...tab, language, dirty: false, cursorLine: 1, cursorColumn: 1 },
      ],
      activeTabId: tab.id,
    }));
  },

  closeTab: (id) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeTabId = s.activeTabId;
      if (activeTabId === id) {
        activeTabId = tabs.length ? tabs[tabs.length - 1].id : null;
      }
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateContent: (id, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, content, dirty: true } : t)),
    })),

  setCursor: (id, line, column) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, cursorLine: line, cursorColumn: column } : t)),
    })),

  markClean: (id) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, dirty: false } : t)),
    })),

  setGhostText: (text) => set({ ghostText: text }),
  setInlineEditOpen: (open) => set({ inlineEditOpen: open, inlineEditPrompt: open ? get().inlineEditPrompt : '' }),
  setInlineEditPrompt: (prompt) => set({ inlineEditPrompt: prompt }),
  setInlineEditPreview: (preview) => set({ inlineEditPreview: preview }),
  setDiffModal: (modal) => set({ diffModal: modal }),
  getActiveTab: () => get().tabs.find((t) => t.id === get().activeTabId),
}));
