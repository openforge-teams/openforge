import type { ApprovalDecision, ApprovalRequest, RiskLevel } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

export interface ApprovalPolicy {
  autoApproveSafe?: boolean;
  autoApproveLow?: boolean;
  alwaysAllowed?: Set<string>;
  alwaysDenied?: Set<string>;
}

export class ApprovalQueue {
  private readonly queue: ApprovalRequest[] = [];
  private readonly alwaysAllowed = new Set<string>();
  private readonly alwaysDenied = new Set<string>();
  private readonly policy: ApprovalPolicy;

  constructor(policy: ApprovalPolicy = {}) {
    this.policy = policy;
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

    if (risk === 'safe' && this.policy.autoApproveSafe) return true;
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

    if (!decide) return false;

    const decision = await decide(req);
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
  }

  pending(): ApprovalRequest[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue.length = 0;
  }
}
