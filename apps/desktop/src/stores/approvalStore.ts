import { create } from 'zustand';
import type { ApprovalRequest, ApprovalDecision, RiskLevel } from '@openforge/core/browser';

interface ApprovalState {
  queue: ApprovalRequest[];
  current: ApprovalRequest | null;
  autoApprove: Partial<Record<RiskLevel, boolean>>;
  alwaysAllowedTools: Set<string>;
  enqueue: (req: ApprovalRequest) => void;
  resolve: (id: string, decision: ApprovalDecision) => void;
  setAutoApprove: (risk: RiskLevel, value: boolean) => void;
  shouldAutoApprove: (req: ApprovalRequest) => boolean;
  pendingResolvers: Map<string, (d: ApprovalDecision) => void>;
  waitForApproval: (
    req: ApprovalRequest | Omit<ApprovalRequest, 'id' | 'createdAt'>,
  ) => Promise<ApprovalDecision>;
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  queue: [],
  current: null,
  autoApprove: { safe: true, low: false, high: false },
  alwaysAllowedTools: new Set<string>(),
  pendingResolvers: new Map(),

  enqueue: (req) =>
    set((s) => ({
      queue: [...s.queue, req],
      current: s.current ?? req,
    })),

  resolve: (id, decision) => {
    const state = get();
    const req = state.queue.find((r) => r.id === id);
    const resolver = state.pendingResolvers.get(id);
    resolver?.(decision);

    if (decision === 'always' && req) {
      state.alwaysAllowedTools.add(req.toolName);
      state.setAutoApprove(req.risk, true);
    }

    set((s) => {
      const queue = s.queue.filter((r) => r.id !== id);
      return {
        queue,
        current: queue[0] ?? null,
        alwaysAllowedTools: new Set(state.alwaysAllowedTools),
        pendingResolvers: new Map([...s.pendingResolvers].filter(([k]) => k !== id)),
      };
    });
  },

  setAutoApprove: (risk, value) =>
    set((s) => ({ autoApprove: { ...s.autoApprove, [risk]: value } })),

  shouldAutoApprove: (req) => {
    const s = get();
    if (s.alwaysAllowedTools.has(req.toolName)) return true;
    return !!s.autoApprove[req.risk];
  },

  waitForApproval: (req) => {
    const full: ApprovalRequest = {
      toolName: req.toolName,
      arguments: req.arguments,
      risk: req.risk,
      reason: req.reason,
      id: 'id' in req && req.id ? req.id : crypto.randomUUID(),
      createdAt: 'createdAt' in req && req.createdAt ? req.createdAt : Date.now(),
    };

    if (get().shouldAutoApprove(full)) {
      return Promise.resolve('once' as ApprovalDecision);
    }

    get().enqueue(full);
    return new Promise<ApprovalDecision>((resolve) => {
      get().pendingResolvers.set(full.id, resolve);
    });
  },
}));
