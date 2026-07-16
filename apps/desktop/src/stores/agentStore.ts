import { create } from 'zustand';
import type { AgentStep, AgentEvent } from '@openforge/core/browser';

export interface AgentStepEntry {
  id: string;
  step: AgentStep;
  label: string;
  timestamp: number;
  status: 'pending' | 'active' | 'done' | 'error';
}

interface AgentState {
  running: boolean;
  steps: AgentStepEntry[];
  progress: number;
  events: AgentEvent[];
  addStep: (step: AgentStep, label?: string) => void;
  completeStep: (id: string) => void;
  addEvent: (event: AgentEvent) => void;
  setRunning: (v: boolean) => void;
  setProgress: (v: number) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  running: false,
  steps: [],
  progress: 0,
  events: [],

  addStep: (step, label) => {
    const entry: AgentStepEntry = {
      id: crypto.randomUUID(),
      step,
      label: label ?? step,
      timestamp: Date.now(),
      status: 'active',
    };
    set((s) => ({
      steps: [...s.steps.map((st) => ({ ...st, status: st.status === 'active' ? 'done' as const : st.status })), entry],
      progress: Math.min(95, s.progress + 15),
    }));
  },

  completeStep: (id) =>
    set((s) => ({
      steps: s.steps.map((st) => (st.id === id ? { ...st, status: 'done' } : st)),
      progress: 100,
    })),

  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),

  setRunning: (v) => set({ running: v, progress: v ? get().progress : 0 }),

  setProgress: (v) => set({ progress: v }),

  reset: () => set({ running: false, steps: [], progress: 0, events: [] }),
}));
