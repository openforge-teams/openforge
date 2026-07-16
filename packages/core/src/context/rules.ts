import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RuleSet } from '../types.js';

const RULE_SOURCES: Array<{ path: string; priority: number; global?: boolean }> = [
  { path: join(homedir(), '.openforge', 'rules.md'), priority: 10, global: true },
  { path: '.ai/rules.md', priority: 20 },
  { path: '.cursorrules', priority: 30 },
  { path: 'AGENTS.md', priority: 40 },
];

export async function loadRules(projectRoot: string): Promise<RuleSet[]> {
  const rules: RuleSet[] = [];

  for (const source of RULE_SOURCES) {
    const fullPath = source.global ? source.path : join(projectRoot, source.path);
    try {
      const content = (await readFile(fullPath, 'utf8')).trim();
      if (content) {
        rules.push({
          source: source.global ? `~/${source.path.split('/').slice(-2).join('/')}` : source.path,
          priority: source.priority,
          content,
        });
      }
    } catch {
      // rule file not present
    }
  }

  return rules.sort((a, b) => a.priority - b.priority);
}

export function mergeRules(rules: RuleSet[]): string {
  if (rules.length === 0) return '';

  const sections = rules.map(
    (r) => `<!-- source: ${r.source} -->\n${r.content}`,
  );

  return sections.join('\n\n---\n\n');
}

export async function getMergedRules(projectRoot: string): Promise<string> {
  const rules = await loadRules(projectRoot);
  return mergeRules(rules);
}
