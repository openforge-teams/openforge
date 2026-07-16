import { createInterface } from 'node:readline';
import type { ApprovalDecision, ApprovalRequest } from '@openforge/core';
import { ApprovalQueue } from '@openforge/core';
import { ansi, color } from './colors.js';

function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function promptApproval(req: ApprovalRequest): Promise<ApprovalDecision> {
  console.log('');
  console.log(color('⚠ Approval required', ansi.yellow + ansi.bold));
  console.log(color(`  Tool: ${req.toolName}`, ansi.cyan));
  console.log(color(`  Risk: ${req.risk}`, req.risk === 'high' ? ansi.red : ansi.yellow));
  if (req.reason) console.log(color(`  Reason: ${req.reason}`, ansi.dim));
  console.log(color(`  Args: ${JSON.stringify(req.arguments, null, 2)}`, ansi.gray));

  const answer = await promptLine(
    color('Approve? [y]es / [n]o / [a]lways: ', ansi.bold),
  );

  const lower = answer.toLowerCase();
  if (lower === 'a' || lower === 'always') return 'always';
  if (lower === 'y' || lower === 'yes') return 'once';
  return 'deny';
}

export class CliApprovalQueue extends ApprovalQueue {
  constructor(policy: ConstructorParameters<typeof ApprovalQueue>[0] = {}) {
    super({
      ...policy,
      prompt: async (req) => {
        // Only interactive-prompt high-risk tools; low/safe follow policy defaults
        if (req.risk === 'high') {
          return promptApproval(req);
        }
        return 'once';
      },
    });
  }
}
