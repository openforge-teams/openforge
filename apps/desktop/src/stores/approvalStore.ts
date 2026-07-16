import { create } from 'zustand';
import type { ApprovalRequest, ApprovalDecision, RiskLevel } from '@openforge/core/browser';

interface ApprovalState {
  queue: ApprovalRequest[];
  current: ApprovalRequest | null;
  autoApprove: Partial<Record<RiskLevel, boolean>>;
  enqueue: (req: ApprovalRequest) => void;
  resolve: (id: string, decision: ApprovalDecision) => void;
  setAutoApprove: (risk: RiskLevel, value: boolean) => void;
  shouldAutoApprove: (risk: RiskLevel) => boolean;
  pendingResolvers: Map<string, (d: ApprovalDecision) => void>;
  waitForApproval: (
    req: ApprovalRequest | Omit<ApprovalRequest, 'id' | 'createdAt'>,
  ) => Promise<ApprovalDecision>;
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  queue: [],
  current: null,
  autoApprove: { safe: true, low: false, high: false },
  pendingResolvers: new Map(),

  enqueue: (req) =>
    set((s) => ({
      queue: [...s.queue, req],
      current: s.current ?? req,
    })),

  resolve: (id, decision) => {
    const resolver = get().pendingResolvers.get(id);
    resolver?.(decision);
    set((s) => {
      const queue = s.queue.filter((r) => r.id !== id);
      return {
        queue,
        current: queue[0] ?? null,
        pendingResolvers: new Map([...s.pendingResolvers].filter(([k]) => k !== id)),
      };
    });
  },

  setAutoApprove: (risk, value) =>
    set((s) => ({ autoApprove: { ...s.autoApprove, [risk]: value } })),

  shouldAutoApprove: (risk) => !!get().autoApprove[risk],

  waitForApproval: (req) => {
    if (get().shouldAutoApprove(req.risk)) {
      return Promise.resolve('once' as ApprovalDecision);
    }
    const full: ApprovalRequest = {
      toolName: req.toolName,
      arguments: req.arguments,
      risk: req.risk,
      reason: req.reason,
      id: 'id' in req && req.id ? req.id : crypto.randomUUID(),
      createdAt: 'createdAt' in req && req.createdAt ? req.createdAt : Date.now(),
    };
    get().enqueue(full);
    return new Promise<ApprovalDecision>((resolve) => {
      get().pendingResolvers.set(full.id, resolve);
    });
  },
}));
