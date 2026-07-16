import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContextRef, IndexChunk, Message, RagHit } from '../types.js';
import { formatRagHits, searchChunks } from './rag.js';
import { getMergedRules } from './rules.js';

export interface AssembleContextOptions {
  projectRoot: string;
  userMessage: string;
  refs?: ContextRef[];
  openFile?: string;
  selection?: { startLine: number; endLine: number; content: string };
  chunks?: IndexChunk[];
  ragTopK?: number;
  systemPrefix?: string;
}

export async function assembleContext(options: AssembleContextOptions): Promise<Message[]> {
  const messages: Message[] = [];
  const systemParts: string[] = [];

  if (options.systemPrefix) {
    systemParts.push(options.systemPrefix);
  }

  const rules = await getMergedRules(options.projectRoot);
  if (rules) {
    systemParts.push(`# Project Rules\n\n${rules}`);
  }

  if (options.openFile) {
    try {
      const content = await readFile(join(options.projectRoot, options.openFile), 'utf8');
      systemParts.push(`# Currently Open File: ${options.openFile}\n\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\``);
    } catch {
      systemParts.push(`# Currently Open File: ${options.openFile} (unreadable)`);
    }
  }

  if (options.selection) {
    systemParts.push(
      `# Current Selection (lines ${options.selection.startLine}-${options.selection.endLine})\n\n\`\`\`\n${options.selection.content}\n\`\`\``,
    );
  }

  const refContent = await resolveRefs(options.projectRoot, options.refs ?? []);
  if (refContent) {
    systemParts.push(refContent);
  }

  if (options.chunks && options.chunks.length > 0) {
    const ragHits = searchChunks(options.userMessage, options.chunks, {
      topK: options.ragTopK ?? 8,
      pathHint: options.openFile,
    });
    const formatted = formatRagHits(ragHits);
    if (formatted) {
      systemParts.push(`# Relevant Codebase Context\n\n${formatted}`);
    }
  }

  if (systemParts.length > 0) {
    messages.push({
      id: `system-${Date.now()}`,
      role: 'system',
      content: systemParts.join('\n\n'),
      createdAt: Date.now(),
    });
  }

  messages.push({
    id: `user-${Date.now()}`,
    role: 'user',
    content: options.userMessage,
    createdAt: Date.now(),
  });

  return messages;
}

async function resolveRefs(projectRoot: string, refs: ContextRef[]): Promise<string> {
  const parts: string[] = [];

  for (const ref of refs) {
    switch (ref.type) {
      case 'file': {
        try {
          const content = await readFile(join(projectRoot, ref.value), 'utf8');
          parts.push(`# @file ${ref.value}\n\n\`\`\`\n${content.slice(0, 6000)}\n\`\`\``);
        } catch {
          parts.push(`# @file ${ref.value} (not found)`);
        }
        break;
      }
      case 'folder': {
        const { readdir } = await import('node:fs/promises');
        try {
          const entries = await readdir(join(projectRoot, ref.value));
          parts.push(`# @folder ${ref.value}\n\n${entries.join('\n')}`);
        } catch {
          parts.push(`# @folder ${ref.value} (not found)`);
        }
        break;
      }
      case 'selection': {
        parts.push(`# @selection\n\n${ref.value}`);
        break;
      }
      case 'codebase': {
        parts.push(`# @codebase query: ${ref.value}`);
        break;
      }
    }
  }

  return parts.join('\n\n');
}

export function parseRefs(text: string): { cleanText: string; refs: ContextRef[] } {
  const refs: ContextRef[] = [];
  let cleanText = text;

  const patterns: Array<{ regex: RegExp; type: ContextRef['type'] }> = [
    { regex: /@file\s+(\S+)/g, type: 'file' },
    { regex: /@folder\s+(\S+)/g, type: 'folder' },
    { regex: /@codebase(?:\s+([^\n]+))?/g, type: 'codebase' },
    { regex: /@selection/g, type: 'selection' },
  ];

  for (const { regex, type } of patterns) {
    cleanText = cleanText.replace(regex, (_match, capture) => {
      refs.push({
        type,
        value: capture?.trim() ?? '',
      });
      return '';
    });
  }

  return { cleanText: cleanText.trim(), refs };
}

export function ragHitsToContext(hits: RagHit[]): string {
  return formatRagHits(hits);
}
