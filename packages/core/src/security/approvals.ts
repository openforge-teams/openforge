import type { ApprovalDecision, ApprovalRequest, RiskLevel } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

export interface ApprovalPolicy {
  autoApproveSafe?: boolean;
  autoApproveLow?: boolean;
  alwaysAllowed?: Set<string>;
  alwaysDenied?: Set<string>;
  /** Host-provided prompt used when decide is not passed per-call. */
  prompt?: (req: ApprovalRequest) => Promise<ApprovalDecision>;
}

export class ApprovalQueue {
  private readonly queue: ApprovalRequest[] = [];
  private readonly alwaysAllowed = new Set<string>();
  private readonly alwaysDenied = new Set<string>();
  protected readonly policy: ApprovalPolicy;

  constructor(policy: ApprovalPolicy = {}) {
    this.policy = {
      autoApproveSafe: policy.autoApproveSafe ?? true,
      autoApproveLow: policy.autoApproveLow ?? false,
      ...policy,
    };
    if (policy.alwaysAllowed) {
      for (const name of policy.alwaysAllowed) this.alwaysAllowed.add(name);
    }
    if (policy.alwaysDenied) {
      for (const name of policy.alwaysDenied) this.alwaysDenied.add(name);
    }
  }

  async request(
    toolName: string,
    args: Record<string, unknown>,
    risk: RiskLevel,
    reason?: string,
    decide?: (req: ApprovalRequest) => Promise<ApprovalDecision>,
  ): Promise<boolean> {
    if (this.alwaysDenied.has(toolName)) return false;
    if (this.alwaysAllowed.has(toolName)) return true;

    if (risk === 'safe' && this.policy.autoApproveSafe !== false) return true;
    if (risk === 'low' && this.policy.autoApproveLow) return true;
    if (risk === 'safe') return true;

    const req: ApprovalRequest = {
      id: uuidv4(),
      toolName,
      arguments: args,
      risk,
      reason,
      createdAt: Date.now(),
    };

    this.queue.push(req);

    const prompt = decide ?? this.policy.prompt;
    if (!prompt) {
      this.dequeue(req.id);
      // Deny by default when no interactive prompt is available
      return false;
    }

    try {
      const decision = await prompt(req);
      switch (decision) {
        case 'always':
          this.alwaysAllowed.add(toolName);
          return true;
        case 'once':
          return true;
        case 'deny':
        default:
          return false;
      }
    } finally {
      this.dequeue(req.id);
    }
  }

  pending(): ApprovalRequest[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue.length = 0;
  }

  private dequeue(id: string): void {
    const idx = this.queue.findIndex((r) => r.id === id);
    if (idx >= 0) this.queue.splice(idx, 1);
  }
}
