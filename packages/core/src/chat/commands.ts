import { CodeIndexer } from '../context/indexer.js';
import type { AgentMode, CommandContext, SlashCommand } from '../types.js';
import type { SessionManager } from './session.js';

export interface CommandHandlers {
  sessionManager: SessionManager;
  setModel?: (model: string) => void;
  getModel?: () => string | undefined;
}

export function createSlashCommands(handlers: CommandHandlers): SlashCommand[] {
  return [
    {
      name: 'clear',
      description: 'Clear messages in the current session',
      handler: (_args, ctx) => {
        const session = handlers.sessionManager.get(ctx.sessionId);
        if (!session) return 'No active session';
        handlers.sessionManager.clear(session);
        return 'Session cleared';
      },
    },
    {
      name: 'reset',
      description: 'Reset session (alias for /clear)',
      handler: (_args, ctx) => {
        const session = handlers.sessionManager.get(ctx.sessionId);
        if (!session) return 'No active session';
        handlers.sessionManager.clear(session);
        return 'Session reset';
      },
    },
    {
      name: 'index',
      description: 'Reindex the codebase',
      handler: async (_args, ctx) => {
        const indexer = new CodeIndexer({ projectRoot: ctx.projectRoot });
        await indexer.initialize();
        const count = await indexer.indexAll();
        return `Indexed ${count} chunks`;
      },
    },
    {
      name: 'model',
      description: 'Show or set the active model',
      handler: (args, _ctx) => {
        const trimmed = args.trim();
        if (!trimmed) {
          return handlers.getModel?.() ?? 'No model configured';
        }
        handlers.setModel?.(trimmed);
        return `Model set to ${trimmed}`;
      },
    },
    {
      name: 'plan',
      description: 'Switch to plan mode',
      handler: (_args, ctx) => {
        ctx.setMode('plan');
        return 'Switched to plan mode';
      },
    },
    {
      name: 'ask',
      description: 'Switch to ask mode (read-only)',
      handler: (_args, ctx) => {
        ctx.setMode('ask');
        return 'Switched to ask mode';
      },
    },
    {
      name: 'agent',
      description: 'Switch to agent mode',
      handler: (_args, ctx) => {
        ctx.setMode('agent');
        return 'Switched to agent mode';
      },
    },
    {
      name: 'export',
      description: 'Export current session as JSON',
      handler: (_args, ctx) => {
        const session = handlers.sessionManager.get(ctx.sessionId);
        if (!session) return 'No active session';
        return handlers.sessionManager.exportSession(session);
      },
    },
    {
      name: 'help',
      description: 'List available slash commands',
      handler: (_args, _ctx) => {
        const cmds = createSlashCommands(handlers);
        return cmds.map((c) => `/${c.name} — ${c.description}`).join('\n');
      },
    },
  ];
}

export function parseSlashCommand(input: string): { command: string; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return { command: trimmed.slice(1), args: '' };
  }
  return {
    command: trimmed.slice(1, spaceIdx),
    args: trimmed.slice(spaceIdx + 1),
  };
}

export async function executeSlashCommand(
  input: string,
  commands: SlashCommand[],
  ctx: CommandContext,
): Promise<string | null> {
  const parsed = parseSlashCommand(input);
  if (!parsed) return null;

  const cmd = commands.find((c) => c.name === parsed.command);
  if (!cmd) return `Unknown command: /${parsed.command}`;

  return cmd.handler(parsed.args, ctx);
}

export function applyModeCommand(command: string): AgentMode | null {
  switch (command) {
    case 'plan':
      return 'plan';
    case 'ask':
      return 'ask';
    case 'agent':
      return 'agent';
    default:
      return null;
  }
}
