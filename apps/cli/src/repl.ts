import { createInterface } from 'node:readline';
import {
  SessionManager,
  createSlashCommands,
  executeSlashCommand,
  parseSlashCommand,
  type AgentMode,
} from '@openforge/core';
import { ansi, color } from './colors.js';
import { createEngine, loadConfig, type CliOptions } from './runtime.js';
import { printEvent } from './stream.js';

export async function startRepl(options: CliOptions): Promise<void> {
  const config = await loadConfig(options.cwd);
  const sessionManager = new SessionManager(options.cwd);
  let session = sessionManager.create('CLI Chat', 'agent');
  let currentMode: AgentMode = session.mode;

  const slashCommands = createSlashCommands({
    sessionManager,
    getModel: () => options.model,
    setModel: (model) => {
      options.model = model;
    },
  });

  console.log(color('OpenForge', ansi.cyan + ansi.bold));
  console.log(color(`Project: ${options.cwd}`, ansi.dim));
  console.log(color('Type a message, /help for commands, exit to quit.\n', ansi.gray));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: color('you> ', ansi.cyan),
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === 'exit' || input === 'quit') {
      rl.close();
      return;
    }

    if (input.startsWith('/')) {
      const parsed = parseSlashCommand(input);
      if (parsed) {
        const ctx = {
          projectRoot: options.cwd,
          sessionId: session.id,
          mode: currentMode,
          setMode: (mode: AgentMode) => {
            currentMode = mode;
            session = sessionManager.setMode(session, mode);
          },
        };
        const result = await executeSlashCommand(input, slashCommands, ctx);
        console.log(color(result ?? 'Done', ansi.yellow));
      } else {
        console.log(color('Unknown command. Try /help', ansi.red));
      }
      rl.prompt();
      return;
    }

    try {
      const engine = createEngine(options, config, currentMode);
      engine.loadState({
        id: session.id,
        mode: currentMode,
        messages: session.messages,
        stepCount: 0,
        currentStep: 'plan',
        pendingToolCalls: [],
        retryCount: 0,
        completed: false,
      });

      for await (const event of engine.run(input)) {
        printEvent(event);
        if (event.type === 'message' && event.message) {
          session = sessionManager.addMessage(session, event.message);
        }
      }

      const state = engine.getState();
      session = { ...session, messages: state.messages, mode: state.mode };
      await sessionManager.save(session);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(color(`Error: ${msg}`, ansi.red));
    }

    rl.prompt();
  });

  await new Promise<void>((resolve) => rl.on('close', resolve));
}

export async function runTask(
  options: CliOptions,
  mode: AgentMode,
  task: string,
): Promise<void> {
  const config = await loadConfig(options.cwd);
  const engine = createEngine(options, config, mode);

  for await (const event of engine.run(task)) {
    printEvent(event);
    if (event.type === 'error') {
      process.exitCode = 1;
      return;
    }
  }
}
