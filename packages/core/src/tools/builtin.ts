import { applyPatch as diffApplyPatch } from 'diff';
import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { CodeIndexer } from '../context/indexer.js';
import { AuditLog } from '../security/audit.js';
import { CheckpointManager } from '../security/checkpoint.js';
import { sanitizePath, validateCommand } from '../security/sandbox.js';
import type { FileChange, ToolContext, ToolDefinition } from '../types.js';
import { globalToolRegistry } from './registry.js';

const execFileAsync = promisify(execFile);

const readFileSchema = z.object({
  path: z.string(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
});

const writeFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

const editFileSchema = z.object({
  path: z.string(),
  oldText: z.string(),
  newText: z.string(),
});

const deleteFileSchema = z.object({
  path: z.string(),
});

const listDirSchema = z.object({
  path: z.string().default('.'),
});

const searchCodeSchema = z.object({
  query: z.string(),
  topK: z.number().optional(),
});

const runTerminalSchema = z.object({
  command: z.string(),
  cwd: z.string().optional(),
});

const gitSchema = z.object({
  args: z.array(z.string()).optional(),
});

const gitCommitMsgSchema = z.object({
  staged: z.boolean().optional(),
});

const checkpointSchema = z.object({
  label: z.string(),
});

const applyPatchSchema = z.object({
  path: z.string(),
  patch: z.string(),
});

let sharedIndexer: CodeIndexer | undefined;

function getIndexer(projectRoot: string): CodeIndexer {
  if (!sharedIndexer || sharedIndexer.projectRoot !== projectRoot) {
    sharedIndexer = new CodeIndexer({ projectRoot });
  }
  return sharedIndexer;
}

async function runGit(projectRoot: string, args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  return (stdout || stderr).trim();
}

async function ensureApproval(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
  risk: 'safe' | 'low' | 'high',
): Promise<void> {
  if (!ctx.requestApproval) return;
  const approved = await ctx.requestApproval({ toolName, arguments: args, risk });
  if (approved === 'deny') {
    throw new Error(`Approval denied for ${toolName}`);
  }
}

export function createBuiltinTools(): ToolDefinition[] {
  return [
    {
      name: 'read_file',
      description: 'Read file contents, optionally a line range',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          startLine: { type: 'number' },
          endLine: { type: 'number' },
        },
        required: ['path'],
      },
      risk: 'safe',
      execute: async (raw, ctx) => {
        const args = readFileSchema.parse(raw);
        const abs = sanitizePath(ctx.projectRoot, args.path);
        const content = await readFile(abs, 'utf8');
        const lines = content.split('\n');

        if (args.startLine !== undefined || args.endLine !== undefined) {
          const start = Math.max(1, args.startLine ?? 1);
          const end = Math.min(lines.length, args.endLine ?? lines.length);
          return lines.slice(start - 1, end).map((l, i) => `${start + i}|${l}`).join('\n');
        }

        return lines.map((l, i) => `${i + 1}|${l}`).join('\n');
      },
    },
    {
      name: 'write_file',
      description: 'Write content to a file, creating directories as needed',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
      risk: 'high',
      execute: async (raw, ctx) => {
        const args = writeFileSchema.parse(raw);
        await ensureApproval(ctx, 'write_file', raw, 'high');
        const abs = sanitizePath(ctx.projectRoot, args.path);
        const rel = relative(ctx.projectRoot, abs);
        const before = await readFile(abs, 'utf8').catch(() => undefined);

        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, args.content, 'utf8');

        const change: FileChange = {
          path: rel,
          before,
          after: args.content,
          operation: before === undefined ? 'create' : 'update',
        };
        ctx.onFileChange?.(change);
        await new AuditLog(ctx.projectRoot).append('write_file', { path: rel });
        return `Wrote ${rel} (${args.content.length} bytes)`;
      },
    },
    {
      name: 'edit_file',
      description: 'Replace exact text in a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          oldText: { type: 'string' },
          newText: { type: 'string' },
        },
        required: ['path', 'oldText', 'newText'],
      },
      risk: 'high',
      execute: async (raw, ctx) => {
        const args = editFileSchema.parse(raw);
        await ensureApproval(ctx, 'edit_file', raw, 'high');
        const abs = sanitizePath(ctx.projectRoot, args.path);
        const rel = relative(ctx.projectRoot, abs);
        const before = await readFile(abs, 'utf8');

        if (!before.includes(args.oldText)) {
          throw new Error(`oldText not found in ${rel}`);
        }

        const after = before.replace(args.oldText, args.newText);
        await writeFile(abs, after, 'utf8');

        ctx.onFileChange?.({ path: rel, before, after, operation: 'update' });
        await new AuditLog(ctx.projectRoot).append('edit_file', { path: rel });
        return `Edited ${rel}`;
      },
    },
    {
      name: 'delete_file',
      description: 'Delete a file',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      risk: 'high',
      execute: async (raw, ctx) => {
        const args = deleteFileSchema.parse(raw);
        await ensureApproval(ctx, 'delete_file', raw, 'high');
        const abs = sanitizePath(ctx.projectRoot, args.path);
        const rel = relative(ctx.projectRoot, abs);
        const before = await readFile(abs, 'utf8').catch(() => undefined);

        await rm(abs, { force: true });
        ctx.onFileChange?.({ path: rel, before, operation: 'delete' });
        await new AuditLog(ctx.projectRoot).append('delete_file', { path: rel });
        return `Deleted ${rel}`;
      },
    },
    {
      name: 'list_dir',
      description: 'List directory entries',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
      },
      risk: 'safe',
      execute: async (raw, ctx) => {
        const args = listDirSchema.parse(raw);
        const abs = sanitizePath(ctx.projectRoot, args.path);
        const entries = await readdir(abs, { withFileTypes: true });
        return entries
          .map((e) => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`)
          .join('\n');
      },
    },
    {
      name: 'search_code',
      description: 'Search indexed codebase chunks',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          topK: { type: 'number' },
        },
        required: ['query'],
      },
      risk: 'safe',
      execute: async (raw, ctx) => {
        const args = searchCodeSchema.parse(raw);
        const indexer = getIndexer(ctx.projectRoot);
        await indexer.initialize();
        const { searchChunks, formatRagHits } = await import('../context/rag.js');
        const hits = searchChunks(args.query, indexer.getChunks(), { topK: args.topK ?? 10 });
        return formatRagHits(hits) || 'No results';
      },
    },
    {
      name: 'run_terminal',
      description: 'Run a shell command in the project',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          cwd: { type: 'string' },
        },
        required: ['command'],
      },
      risk: 'high',
      execute: async (raw, ctx) => {
        const args = runTerminalSchema.parse(raw);
        const check = validateCommand(args.command);
        if (!check.allowed) throw new Error(check.reason);

        await ensureApproval(ctx, 'run_terminal', raw, 'high');

        const cwd = args.cwd ? sanitizePath(ctx.projectRoot, args.cwd) : ctx.cwd;
        const { stdout, stderr } = await execFileAsync('sh', ['-c', args.command], {
          cwd,
          maxBuffer: 10 * 1024 * 1024,
          signal: ctx.signal,
        });

        await new AuditLog(ctx.projectRoot).append('run_terminal', { command: args.command });
        return [stdout, stderr].filter(Boolean).join('\n').trim() || '(no output)';
      },
    },
    {
      name: 'git_status',
      description: 'Show git status',
      parameters: { type: 'object', properties: {} },
      risk: 'safe',
      execute: async (_raw, ctx) => runGit(ctx.projectRoot, ['status', '--short']),
    },
    {
      name: 'git_diff',
      description: 'Show git diff',
      parameters: {
        type: 'object',
        properties: { args: { type: 'array', items: { type: 'string' } } },
      },
      risk: 'safe',
      execute: async (raw, ctx) => {
        const args = gitSchema.parse(raw);
        return runGit(ctx.projectRoot, ['diff', ...(args.args ?? [])]);
      },
    },
    {
      name: 'git_log',
      description: 'Show git log',
      parameters: {
        type: 'object',
        properties: { args: { type: 'array', items: { type: 'string' } } },
      },
      risk: 'safe',
      execute: async (raw, ctx) => {
        const args = gitSchema.parse(raw);
        return runGit(ctx.projectRoot, ['log', '--oneline', '-n', '20', ...(args.args ?? [])]);
      },
    },
    {
      name: 'git_commit_msg',
      description: 'Suggest a commit message based on staged changes',
      parameters: {
        type: 'object',
        properties: { staged: { type: 'boolean' } },
      },
      risk: 'low',
      execute: async (raw, ctx) => {
        gitCommitMsgSchema.parse(raw);
        const diff = await runGit(ctx.projectRoot, ['diff', '--staged']);
        if (!diff) return 'No staged changes';
        const files = [...diff.matchAll(/^diff --git a\/(\S+)/gm)].map((m) => m[1]);
        return `Suggested commit message:\n\nchore: update ${files.slice(0, 3).join(', ')}${files.length > 3 ? ' and others' : ''}\n\n${diff.slice(0, 2000)}`;
      },
    },
    {
      name: 'create_checkpoint',
      description: 'Create a checkpoint of recent file changes',
      parameters: {
        type: 'object',
        properties: { label: { type: 'string' } },
        required: ['label'],
      },
      risk: 'low',
      execute: async (raw, ctx) => {
        const args = checkpointSchema.parse(raw);
        const mgr = new CheckpointManager(ctx.projectRoot);
        const cp = await mgr.create(args.label, []);
        return `Checkpoint created: ${cp.id} (${args.label})`;
      },
    },
    {
      name: 'apply_patch',
      description: 'Apply a unified diff patch to a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          patch: { type: 'string' },
        },
        required: ['path', 'patch'],
      },
      risk: 'high',
      execute: async (raw, ctx) => {
        const args = applyPatchSchema.parse(raw);
        await ensureApproval(ctx, 'apply_patch', raw, 'high');
        const abs = sanitizePath(ctx.projectRoot, args.path);
        const rel = relative(ctx.projectRoot, abs);
        const before = await readFile(abs, 'utf8');
        const result = diffApplyPatch(before, args.patch);

        if (!result) throw new Error('Patch did not apply cleanly');
        await writeFile(abs, result, 'utf8');
        ctx.onFileChange?.({ path: rel, before, after: result, operation: 'update' });
        return `Applied patch to ${rel}`;
      },
    },
  ];
}

export function registerBuiltinTools(registry = globalToolRegistry): void {
  for (const tool of createBuiltinTools()) {
    registry.register(tool);
  }
}

registerBuiltinTools();
