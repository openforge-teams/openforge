import * as vscode from 'vscode';
import type { ApprovalDecision, ApprovalRequest } from '@openforge/core';
import { ApprovalQueue } from '@openforge/core';

export class VscodeApprovalQueue extends ApprovalQueue {
  constructor(policy: ConstructorParameters<typeof ApprovalQueue>[0] = {}) {
    super({
      ...policy,
      prompt: async (req) => promptVscodeApproval(req),
    });
  }
}

async function promptVscodeApproval(req: ApprovalRequest): Promise<ApprovalDecision> {
  const detail = req.reason
    ? `${req.reason}\n\n${JSON.stringify(req.arguments, null, 2)}`
    : JSON.stringify(req.arguments, null, 2);

  const choice = await vscode.window.showWarningMessage(
    `OpenForge: approve "${req.toolName}"? (${req.risk} risk)`,
    { modal: req.risk === 'high', detail },
    'Approve once',
    'Always allow',
    'Deny',
  );

  if (choice === 'Always allow') return 'always';
  if (choice === 'Approve once') return 'once';
  return 'deny';
}
