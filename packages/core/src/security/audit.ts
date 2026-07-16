import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuditEntry } from '../types.js';
import { redactSecrets } from './secrets.js';

export class AuditLog {
  constructor(private readonly projectRoot: string) {}

  private get logPath(): string {
    return join(this.projectRoot, '.ai', 'audit.log');
  }

  async append(action: string, details: Record<string, unknown> = {}, actor?: string): Promise<void> {
    const entry: AuditEntry = {
      timestamp: Date.now(),
      action,
      actor,
      details: JSON.parse(redactSecrets(JSON.stringify(details))),
    };

    await mkdir(join(this.projectRoot, '.ai'), { recursive: true });
    await appendFile(this.logPath, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  async read(limit = 100): Promise<AuditEntry[]> {
    try {
      const content = await readFile(this.logPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.slice(-limit).map((line) => JSON.parse(line) as AuditEntry);
    } catch {
      return [];
    }
  }
}
