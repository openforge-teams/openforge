const COMMAND_BLACKLIST: RegExp[] = [
  /\brm\s+(-[^\s]*\s+)*-[^\s]*r[^\s]*f\s+\/\s*$/,
  /\brm\s+(-[^\s]*\s+)*-[^\s]*r[^\s]*f\s+\/\*/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /\bformat\s+[a-z]:/i,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bpoweroff\b/,
  /\binit\s+0\b/,
  /\b:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/,
  /\bchmod\s+-R\s+777\s+\//,
  /\bdel\s+\/[sfq]\s+[a-z]:\\/i,
  /\breg\s+delete/i,
];

export interface SandboxResult {
  allowed: boolean;
  reason?: string;
}

export function validateCommand(command: string): SandboxResult {
  const normalized = command.trim().toLowerCase();

  for (const pattern of COMMAND_BLACKLIST) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        reason: `Command blocked by sandbox policy: matches dangerous pattern ${pattern.source}`,
      };
    }
  }

  if (normalized.includes('> /dev/sd') || normalized.includes('of=/dev/')) {
    return { allowed: false, reason: 'Direct disk write commands are blocked' };
  }

  return { allowed: true };
}

import { isAbsolute, relative, resolve } from 'node:path';

export function sanitizePath(projectRoot: string, targetPath: string): string {
  const abs = isAbsolute(targetPath) ? targetPath : resolve(projectRoot, targetPath);
  const rel = relative(projectRoot, abs);

  if (rel.startsWith('..') || rel === '..') {
    throw new Error(`Path escapes project root: ${targetPath}`);
  }

  return abs;
}

export function isReadOnlyMode(mode: 'agent' | 'plan' | 'ask'): boolean {
  return mode === 'ask' || mode === 'plan';
}

export function blocksWrite(mode: 'agent' | 'plan' | 'ask'): boolean {
  return mode !== 'agent';
}
