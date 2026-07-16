import {
  ModelRouter,
  type ProviderId,
  type AgentMode,
  type ProviderConfig,
  type Message,
  type AgentEvent,
} from '@openforge/core/browser';
import { useSettingsStore, buildProviderConfig } from '@/stores/settingsStore';
import { getFS } from '@/host/fs';
import { useApprovalStore } from '@/stores/approvalStore';

let router: ModelRouter | null = null;
let abortController: AbortController | null = null;

interface BrowserAgentEngine {
  interrupt(): void;
  run(task: string): AsyncGenerator<AgentEvent>;
}

let lastEngine: BrowserAgentEngine | null = null;

export function getModelRouter(): ModelRouter {
  if (!router) {
    const settings = useSettingsStore.getState();
    router = new ModelRouter({
      defaultProvider: settings.defaultProvider,
      providers: buildProviderConfig(settings) as Partial<Record<ProviderId, ProviderConfig>>,
    });
  }
  return router;
}

export function resetModelRouter(): void {
  router = null;
}

export async function getOrCreateSession(_mode: AgentMode = 'agent') {
  return { id: 'desktop-session' };
}

export async function getSessionManager() {
  return {
    addMessage(_session: unknown, _msg: Message) {},
    async save(_session?: unknown) {},
  };
}

/** Frontend agent loop (model + approvals). Full tool loop runs in CLI / Node core. */
export function createAgentEngine(projectRoot: string, mode: AgentMode = 'agent'): BrowserAgentEngine {
  const engine: BrowserAgentEngine = {
    interrupt() {
      abortController?.abort();
    },
    async *run(task: string): AsyncGenerator<AgentEvent> {
      abortController = new AbortController();
      const signal = abortController.signal;
      yield { type: 'step', step: 'plan' };

      try {
        const fs = await getFS();
        let context = `Project: ${projectRoot}\nMode: ${mode}\nTask: ${task}`;
        try {
          const listing = await fs.listDir(projectRoot);
          context += `\nFiles: ${listing.slice(0, 40).map((e) => e.name).join(', ')}`;
        } catch {
          // ignore
        }

        const r = getModelRouter();
        const client = r.getClient();
        const model = r.getModel(mode === 'ask' ? 'chat' : 'agent', task);

        const system =
          mode === 'plan'
            ? 'You are in planning mode. Produce a numbered plan only. Do not claim you modified files.'
            : mode === 'ask'
              ? 'Answer questions about the codebase. Do not modify files.'
              : 'You are an autonomous coding agent. Propose concrete file edits and shell commands. High-risk actions require user approval.';

        let content = '';
        yield { type: 'step', step: 'tool_call' };
        for await (const chunk of client.chatCompletionStream(
          {
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: context },
            ],
            temperature: 0.3,
          },
          signal,
        )) {
          content += chunk.delta.content ?? '';
        }

        if (/rm\s+-rf|format\s+c:|mkfs/i.test(content)) {
          const decision = await useApprovalStore.getState().waitForApproval({
            toolName: 'dangerous_suggestion',
            arguments: { preview: content.slice(0, 200) },
            risk: 'high',
            reason: 'Agent suggested a high-risk operation',
          });
          if (decision === 'deny') {
            yield { type: 'error', error: 'User denied high-risk operation' };
            return;
          }
        }

        const message: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content,
          createdAt: Date.now(),
        };
        yield { type: 'message', message };
        yield { type: 'step', step: 'complete' };
        yield { type: 'done' };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        yield { type: 'error', error };
      } finally {
        abortController = null;
      }
    },
  };

  lastEngine = engine;
  return engine;
}

export function getAgentEngine(): BrowserAgentEngine | null {
  return lastEngine;
}

export function getConfiguredProviders(): ProviderId[] {
  const settings = useSettingsStore.getState();
  return (Object.keys(settings.providers) as ProviderId[]).filter(
    (id) => settings.providers[id].apiKey || id === 'ollama',
  );
}

export async function refreshIndexerFromWorkspace(): Promise<void> {
  // Full disk index available via CLI: `openforge index`
}
