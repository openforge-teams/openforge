import { v4 as uuidv4 } from 'uuid';
import { assembleContext, parseRefs } from '../context/assemble.js';
import { CodeIndexer } from '../context/indexer.js';
import { messagesToApi } from '../models/client.js';
import type { ModelRouter } from '../models/router.js';
import { ApprovalQueue } from '../security/approvals.js';
import { blocksWrite } from '../security/sandbox.js';
import type {
  AgentEvent,
  AgentMode,
  AgentState,
  FileChange,
  Message,
  RolePreset,
  ToolCall,
  ToolContext,
  ToolResult,
} from '../types.js';
import { globalToolRegistry, type ToolRegistry } from '../tools/registry.js';
import { buildPlanningPrompt, parsePlanResponse, planToUserMessage } from './planner.js';
import {
  addMessage,
  canContinue,
  clearPendingToolCalls,
  createInitialState,
  incrementRetry,
  incrementStep,
  markComplete,
  markError,
  MAX_AGENT_STEPS,
  MAX_RETRIES,
  serializeState,
  setPendingToolCalls,
  shouldRetry,
  systemPromptForRole,
  transitionStep,
} from './state.js';

export interface AgentEngineOptions {
  projectRoot: string;
  router: ModelRouter;
  registry?: ToolRegistry;
  mode?: AgentMode;
  role?: RolePreset;
  approvalQueue?: ApprovalQueue;
  onFileChange?: (change: FileChange) => void;
  /** When true (default), inject RAG hits from the project index on first turn. */
  enableRag?: boolean;
}

function parseToolArguments(raw: string | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}') as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { _raw: raw ?? '', _parseError: true };
  }
}

export interface SubAgentResult {
  id: string;
  summary: string;
  state: AgentState;
}

export class AgentEngine {
  private state: AgentState;
  private readonly registry: ToolRegistry;
  private readonly approvalQueue: ApprovalQueue;
  private readonly fileChanges: FileChange[] = [];
  private readonly childEngines: AgentEngine[] = [];
  private abortController: AbortController | null = null;

  constructor(private readonly options: AgentEngineOptions) {
    this.state = createInitialState(options.mode ?? 'agent');
    this.registry = options.registry ?? globalToolRegistry;
    this.approvalQueue = options.approvalQueue ?? new ApprovalQueue({
      autoApproveSafe: true,
      autoApproveLow: false,
    });
  }

  /** Interrupt a running agent loop. */
  interrupt(): void {
    this.abortController?.abort();
    this.state = markError(this.state, 'Interrupted by user');
  }

  getState(): AgentState {
    return this.state;
  }

  loadState(state: AgentState): void {
    this.state = state;
  }

  exportState(): string {
    return serializeState(this.state);
  }

  async *run(
    userMessage: string,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();
    const onExternalAbort = () => this.abortController?.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });
    const runSignal = this.abortController.signal;

    try {
      const isFirstTurn = this.state.messages.length === 0;
      if (isFirstTurn) {
        let chunks = undefined;
        if (this.options.enableRag !== false) {
          try {
            const indexer = new CodeIndexer({ projectRoot: this.options.projectRoot });
            await indexer.initialize();
            const existing = indexer.getChunks();
            if (existing.length === 0) {
              await indexer.indexAll();
            }
            chunks = indexer.getChunks();
          } catch {
            // Indexing is best-effort; agent can still use search_code tool
          }
        }

        const { refs, cleanText } = parseRefs(userMessage);
        const contextMessages = await assembleContext({
          projectRoot: this.options.projectRoot,
          userMessage: cleanText || userMessage,
          refs,
          chunks,
          systemPrefix: systemPromptForRole(this.options.role ?? 'default', this.state.mode),
        });

        for (const msg of contextMessages) {
          this.state = addMessage(this.state, msg);
        }
      } else {
        const { refs, cleanText } = parseRefs(userMessage);
        let content = cleanText || userMessage;
        if (refs.length > 0) {
          const extra = await assembleContext({
            projectRoot: this.options.projectRoot,
            userMessage: content,
            refs,
          });
          // Prefer assembled user message (with resolved refs in system); keep one user msg
          const userMsg = extra.find((m) => m.role === 'user');
          const systemExtra = extra.find((m) => m.role === 'system');
          if (systemExtra) {
            this.state = addMessage(this.state, {
              ...systemExtra,
              id: uuidv4(),
              content: `Additional context for this turn:\n\n${systemExtra.content}`,
            });
          }
          content = userMsg?.content ?? content;
        }
        this.state = addMessage(this.state, {
          id: uuidv4(),
          role: 'user',
          content,
          createdAt: Date.now(),
        });
      }

      yield { type: 'step', step: 'plan' };
      this.state = transitionStep(this.state, 'plan');

      if (this.state.mode === 'plan') {
        const planMessages = buildPlanningPrompt(userMessage, this.state.mode);
        const client = this.options.router.getClient();
        const model = this.options.router.getModel('agent', userMessage);
        const planResponse = await client.chatCompletion({
          model,
          messages: messagesToApi(planMessages),
          temperature: 0.3,
        }, runSignal);

        const content = planResponse.choices[0]?.message?.content ?? '';
        const plan = parsePlanResponse(content);
        const planMsg = planToUserMessage(plan);
        this.state = addMessage(this.state, planMsg);
        yield { type: 'message', message: planMsg };
        this.state = markComplete(this.state);
        yield { type: 'done', data: { plan } };
        return;
      }

      while (canContinue(this.state)) {
        if (runSignal.aborted) {
          this.state = markError(this.state, 'Aborted');
          yield { type: 'error', error: 'Aborted' };
          return;
        }

        this.state = incrementStep(this.state);
        yield { type: 'step', step: 'tool_call', data: { stepCount: this.state.stepCount } };

        const client = this.options.router.getClient();
        const model = this.options.router.getModel('agent', userMessage);
        const tools = this.registry.forMode(this.state.mode);

        const response = await client.chatCompletion({
          model,
          messages: messagesToApi(this.state.messages),
          tools: this.registry.toOpenAITools(tools),
          temperature: 0.2,
        }, runSignal);

        const choice = response.choices[0];
        const assistantContent = choice?.message?.content ?? '';
        const rawToolCalls = choice?.message?.tool_calls ?? [];

        const assistantMsg: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: assistantContent,
          toolCalls: rawToolCalls.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: parseToolArguments(tc.function.arguments),
          })),
          createdAt: Date.now(),
        };

        this.state = addMessage(this.state, assistantMsg);
        yield { type: 'message', message: assistantMsg };

        if (rawToolCalls.length === 0) {
          this.state = markComplete(this.state);
          yield { type: 'done' };
          return;
        }

        const toolCalls: ToolCall[] = assistantMsg.toolCalls ?? [];
        this.state = setPendingToolCalls(this.state, toolCalls);

        for (const call of toolCalls) {
          yield { type: 'tool_call', toolCall: call };

          const result = await this.executeTool(call, runSignal);
          yield { type: 'tool_result', toolResult: result };

          const toolMsg: Message = {
            id: uuidv4(),
            role: 'tool',
            content: result.content,
            toolCallId: result.toolCallId,
            name: result.name,
            createdAt: Date.now(),
          };
          this.state = addMessage(this.state, toolMsg);
        }

        this.state = clearPendingToolCalls(this.state);
        yield { type: 'step', step: 'validate' };
      }

      if (this.state.stepCount >= MAX_AGENT_STEPS) {
        this.state = markError(this.state, 'Max steps reached');
        yield { type: 'error', error: 'Max steps reached' };
      } else {
        this.state = markComplete(this.state);
        yield { type: 'done' };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.state = markError(this.state, error);
      yield { type: 'error', error };
    } finally {
      signal?.removeEventListener('abort', onExternalAbort);
      this.abortController = null;
    }
  }

  private async executeTool(call: ToolCall, signal?: AbortSignal): Promise<ToolResult> {
    const tool = this.registry.get(call.name);
    if (!tool) {
      return {
        toolCallId: call.id,
        name: call.name,
        content: `Unknown tool: ${call.name}`,
        isError: true,
      };
    }

    if (blocksWrite(this.state.mode) && ['write_file', 'edit_file', 'delete_file', 'apply_patch', 'run_terminal'].includes(call.name)) {
      return {
        toolCallId: call.id,
        name: call.name,
        content: `Tool ${call.name} blocked in ${this.state.mode} mode`,
        isError: true,
      };
    }

    const ctx: ToolContext = {
      projectRoot: this.options.projectRoot,
      cwd: this.options.projectRoot,
      signal,
      onFileChange: (change) => {
        this.fileChanges.push(change);
        this.options.onFileChange?.(change);
      },
      getFileChanges: () => [...this.fileChanges],
      requestApproval: async (req) => {
        const approved = await this.approvalQueue.request(
          req.toolName,
          req.arguments,
          req.risk,
          req.reason,
        );
        return approved ? 'once' : 'deny';
      },
    };

    let attempts = 0;
    while (attempts <= MAX_RETRIES) {
      try {
        const content = await tool.execute(call.arguments, ctx);
        return { toolCallId: call.id, name: call.name, content };
      } catch (err) {
        attempts++;
        if (!shouldRetry({ ...this.state, retryCount: attempts - 1 })) {
          return {
            toolCallId: call.id,
            name: call.name,
            content: err instanceof Error ? err.message : String(err),
            isError: true,
          };
        }
        this.state = incrementRetry(this.state);
      }
    }

    return {
      toolCallId: call.id,
      name: call.name,
      content: 'Tool execution failed after retries',
      isError: true,
    };
  }

  async spawnSubAgent(
    task: string,
    toolNames: string[],
    signal?: AbortSignal,
  ): Promise<SubAgentResult> {
    const subRegistry = new (await import('../tools/registry.js')).ToolRegistry();
    for (const name of toolNames) {
      const tool = this.registry.get(name);
      if (tool) subRegistry.register(tool);
    }

    const subEngine = new AgentEngine({
      ...this.options,
      registry: subRegistry,
      mode: 'agent',
      role: this.options.role,
      approvalQueue: this.approvalQueue,
    });

    this.childEngines.push(subEngine);

    let summary = '';
    for await (const event of subEngine.run(task, signal)) {
      if (event.type === 'message' && event.message?.role === 'assistant') {
        summary = event.message.content;
      }
    }

    return {
      id: subEngine.getState().id,
      summary,
      state: subEngine.getState(),
    };
  }

  getFileChanges(): FileChange[] {
    return [...this.fileChanges];
  }
}

export { MAX_AGENT_STEPS, MAX_RETRIES } from './state.js';
