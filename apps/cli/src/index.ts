#!/usr/bin/env node

import { resolve } from 'node:path';
import { ConfigStore, type ProviderId } from '@openforge/core';
import { loadDotEnv } from './env.js';
import { ansi, color } from './colors.js';
import { startRepl, runTask } from './repl.js';
import {
  getConfigValue,
  listConfiguredProviders,
  loadConfig,
  runIndex,
  setConfigValue,
  type CliOptions,
} from './runtime.js';

const PROVIDERS = new Set<ProviderId>(['openai', 'ollama', 'volcengine', 'custom']);

interface ParsedArgs {
  command: string;
  positional: string[];
  options: CliOptions;
  help: boolean;
}

function printHelp(): void {
  console.log(`
${color('OpenForge CLI', ansi.cyan + ansi.bold)}

${color('Usage:', ansi.bold)}
  openforge [chat]              Interactive REPL chat
  openforge agent "<task>"      Run agent mode on a task
  openforge plan "<task>"       Plan mode (read-only planning)
  openforge ask "<question>"    Ask mode (read-only Q&A)
  openforge index               Rebuild codebase index
  openforge config get <key>    Get config value (dot path)
  openforge config set <k> <v>  Set global config value
  openforge models              List configured providers

${color('Options:', ansi.bold)}
  --provider <id>   openai | ollama | volcengine
  --model <name>    Override model for the active provider
  --cwd <path>      Project root (default: process.cwd())
  --help            Show this help
`);
}

function parseArgv(argv: string[]): ParsedArgs {
  const options: CliOptions = { cwd: process.cwd() };
  const positional: string[] = [];
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    if (arg === '--provider' && argv[i + 1]) {
      const id = argv[++i] as ProviderId;
      if (PROVIDERS.has(id)) options.provider = id;
      continue;
    }

    if (arg === '--model' && argv[i + 1]) {
      options.model = argv[++i];
      continue;
    }

    if (arg === '--cwd' && argv[i + 1]) {
      options.cwd = resolve(argv[++i]!);
      continue;
    }

    if (arg.startsWith('--')) continue;
    positional.push(arg);
  }

  const command = positional[0] ?? 'chat';
  const rest = positional.slice(1);

  return { command, positional: rest, options, help };
}

async function cmdConfig(
  sub: string | undefined,
  args: string[],
  options: CliOptions,
): Promise<void> {
  const store = new ConfigStore();

  if (sub === 'get') {
    const key = args[0];
    if (!key) {
      console.error(color('Usage: openforge config get <key>', ansi.red));
      process.exitCode = 1;
      return;
    }
    const config = await loadConfig(options.cwd);
    const value = getConfigValue(config, key);
    if (value === undefined) {
      console.log(color(`(not set)`, ansi.dim));
    } else if (typeof value === 'object') {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(String(value));
    }
    return;
  }

  if (sub === 'set') {
    const key = args[0];
    const value = args[1];
    if (!key || value === undefined) {
      console.error(color('Usage: openforge config set <key> <value>', ansi.red));
      process.exitCode = 1;
      return;
    }
    const config = await store.loadGlobal();
    const updated = setConfigValue(config, key, value);
    await store.saveGlobal(updated);
    console.log(color(`Set ${key}`, ansi.green));
    return;
  }

  console.error(color('Usage: openforge config set|get ...', ansi.red));
  process.exitCode = 1;
}

async function cmdModels(options: CliOptions): Promise<void> {
  const config = await loadConfig(options.cwd);
  const providers = listConfiguredProviders(config);
  const defaultProvider =
    options.provider
    ?? (process.env.OPENFORGE_DEFAULT_PROVIDER as ProviderId | undefined)
    ?? 'openai';

  console.log(color('Configured providers:', ansi.bold));
  for (const id of providers) {
    const cfg = config.providers[id];
    const models = cfg?.models;
    const marker = id === defaultProvider ? color(' (default)', ansi.cyan) : '';
    console.log(`  ${color(id, ansi.green)}${marker}`);
    if (models) {
      for (const [task, model] of Object.entries(models)) {
        if (model) console.log(color(`    ${task}: ${model}`, ansi.dim));
      }
    }
  }

  if (options.model) {
    console.log(color(`\nCLI override model: ${options.model}`, ansi.yellow));
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const parsed = parseArgv(argv);

  loadDotEnv(parsed.options.cwd);

  if (parsed.help) {
    printHelp();
    return;
  }

  const { command, positional, options } = parsed;

  try {
    switch (command) {
      case 'chat':
        await startRepl(options);
        break;

      case 'agent': {
        const task = positional.join(' ').trim();
        if (!task) {
          console.error(color('Usage: openforge agent "<task>"', ansi.red));
          process.exitCode = 1;
          return;
        }
        await runTask(options, 'agent', task);
        break;
      }

      case 'plan': {
        const task = positional.join(' ').trim();
        if (!task) {
          console.error(color('Usage: openforge plan "<task>"', ansi.red));
          process.exitCode = 1;
          return;
        }
        await runTask(options, 'plan', task);
        break;
      }

      case 'ask': {
        const question = positional.join(' ').trim();
        if (!question) {
          console.error(color('Usage: openforge ask "<question>"', ansi.red));
          process.exitCode = 1;
          return;
        }
        await runTask(options, 'ask', question);
        break;
      }

      case 'index': {
        console.log(color('Indexing codebase…', ansi.blue));
        const count = await runIndex(options.cwd);
        console.log(color(`Indexed ${count} chunks`, ansi.green));
        break;
      }

      case 'config':
        await cmdConfig(positional[0], positional.slice(1), options);
        break;

      case 'models':
        await cmdModels(options);
        break;

      default:
        console.error(color(`Unknown command: ${command}`, ansi.red));
        printHelp();
        process.exitCode = 1;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(color(`Fatal: ${msg}`, ansi.red));
    process.exitCode = 1;
  }
}

main();
