import * as vscode from 'vscode';
import type { AgentMode, OpenForgeConfig, ProviderConfig, ProviderId } from '@openforge/core';

let coreModule: typeof import('@openforge/core') | null = null;

async function getCore(): Promise<typeof import('@openforge/core')> {
  if (!coreModule) {
    coreModule = await import('@openforge/core');
  }
  return coreModule;
}

function getWorkspaceRoot(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    throw new Error('No workspace folder open');
  }
  return folders[0]!.uri.fsPath;
}

function getProviderSettings(): { provider: ProviderId; model?: string } {
  const config = vscode.workspace.getConfiguration('openforge');
  return {
    provider: config.get<ProviderId>('defaultProvider', 'openai'),
    model: config.get<string>('model') || undefined,
  };
}

export async function loadMergedConfig(projectRoot: string): Promise<OpenForgeConfig> {
  const { ConfigStore } = await getCore();
  const store = new ConfigStore();
  return store.loadMerged(projectRoot);
}

export async function createRouter(projectRoot: string) {
  const { ModelRouter } = await getCore();
  const config = await loadMergedConfig(projectRoot);
  const { provider, model } = getProviderSettings();

  const providers: Partial<Record<ProviderId, ProviderConfig>> = {
    ...config.providers,
  };

  if (model) {
    const existing = providers[provider] ?? { id: provider };
    providers[provider] = {
      ...existing,
      id: provider,
      models: {
        ...existing.models,
        chat: model,
        agent: model,
        completion: model,
        small: model,
      },
    };
  }

  return new ModelRouter({
    defaultProvider: provider,
    providers,
  });
}

export async function runAgentTask(
  task: string,
  mode: AgentMode,
  onEvent?: (line: string) => void,
): Promise<string> {
  const { AgentEngine, ApprovalQueue } = await getCore();
  const projectRoot = getWorkspaceRoot();
  const config = await loadMergedConfig(projectRoot);
  const router = await createRouter(projectRoot);

  const summaries: string[] = [];

  const engine = new AgentEngine({
    projectRoot,
    router,
    mode,
    approvalQueue: new ApprovalQueue({
      autoApproveSafe: config.permissions?.autoApproveSafe ?? true,
      autoApproveLow: config.permissions?.autoApproveLow ?? false,
    }),
  });

  for await (const event of engine.run(task)) {
    switch (event.type) {
      case 'message':
        if (event.message?.role === 'assistant' && event.message.content) {
          summaries.push(event.message.content);
          onEvent?.(event.message.content);
        }
        break;
      case 'tool_call':
        onEvent?.(`▸ ${event.toolCall?.name ?? 'tool'}`);
        break;
      case 'error':
        throw new Error(event.error ?? 'Agent error');
    }
  }

  return summaries.at(-1) ?? '';
}

export async function runInlineEdit(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  instruction: string,
): Promise<string> {
  const { InlineCompletionEngine } = await getCore();
  const projectRoot = getWorkspaceRoot();
  const router = await createRouter(projectRoot);
  const engine = new InlineCompletionEngine(router);

  const fullText = document.getText();
  const offset = document.offsetAt(selection.start);
  const prefix = fullText.slice(0, offset);
  const suffix = fullText.slice(document.offsetAt(selection.end));

  const result = await engine.complete({
    filePath: document.fileName,
    prefix: `${prefix}\n// Instruction: ${instruction}\n// Selected:\n${document.getText(selection)}\n// Edit:`,
    suffix,
    language: document.languageId,
    cursorLine: selection.start.line,
    cursorColumn: selection.start.character,
  });

  return result.text;
}

export async function rebuildIndex(): Promise<number> {
  const { CodeIndexer } = await getCore();
  const projectRoot = getWorkspaceRoot();
  const indexer = new CodeIndexer({ projectRoot });
  await indexer.initialize();
  return indexer.indexAll();
}

export { getWorkspaceRoot };
