import { create } from 'zustand';
import type { AgentMode, Message } from '@openforge/core/browser';

export interface ChatMessage extends Message {
  streaming?: boolean;
}

interface ChatState {
  sessionId: string;
  messages: ChatMessage[];
  mode: AgentMode;
  input: string;
  isStreaming: boolean;
  mentionQuery: string | null;
  setInput: (input: string) => void;
  setMode: (mode: AgentMode) => void;
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, content: string, streaming?: boolean) => void;
  setStreaming: (v: boolean) => void;
  setMentionQuery: (q: string | null) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessionId: crypto.randomUUID(),
  messages: [],
  mode: 'agent',
  input: '',
  isStreaming: false,
  mentionQuery: null,

  setInput: (input) => {
    const mentionMatch = input.match(/@([\w./-]*)$/);
    set({
      input,
      mentionQuery: mentionMatch ? mentionMatch[1] : null,
    });
  },

  setMode: (mode) => set({ mode }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage: (id, content, streaming) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content, streaming: streaming ?? m.streaming } : m,
      ),
    })),
  setStreaming: (v) => set({ isStreaming: v }),
  setMentionQuery: (q) => set({ mentionQuery: q }),
  clear: () => set({ messages: [], sessionId: crypto.randomUUID() }),
}));
