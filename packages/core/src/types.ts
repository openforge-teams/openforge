export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type AgentMode = 'agent' | 'plan' | 'ask';

export type ProviderId = 'openai' | 'ollama' | 'volcengine' | 'custom';

export type RiskLevel = 'safe' | 'low' | 'high';

export type ApprovalDecision = 'once' | 'always' | 'deny';

export type AgentStep =
  | 'plan'
  | 'tool_call'
  | 'validate'
  | 'retry'
  | 'complete'
  | 'error';

export type AgentEventType =
  | 'step'
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'approval'
  | 'error'
  | 'done';

export interface Message {
  id: string;
  role: Role;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  createdAt: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  content: string;
  isError?: boolean;
}

export interface ModelConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  supportsFIM?: boolean;
}

export interface ProviderConfig {
  id: ProviderId;
  apiKey?: string;
  baseURL?: string;
  models?: {
    chat?: string;
    completion?: string;
    agent?: string;
    small?: string;
  };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface FileChange {
  path: string;
  before?: string;
  after?: string;
  operation: 'create' | 'update' | 'delete';
}

export interface Checkpoint {
  id: string;
  label: string;
  createdAt: number;
  files: FileChange[];
}

export interface ApprovalRequest {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  risk: RiskLevel;
  reason?: string;
  createdAt: number;
}

export interface IndexChunk {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  symbol?: string;
  content: string;
  mtime: number;
}

export interface RuleSet {
  source: string;
  priority: number;
  content: string;
}

export interface SlashCommand {
  name: string;
  description: string;
  handler: (args: string, ctx: CommandContext) => Promise<string> | string;
}

export interface CommandContext {
  projectRoot: string;
  sessionId: string;
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
}

export interface AgentEvent {
  type: AgentEventType;
  step?: AgentStep;
  message?: Message;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  approval?: ApprovalRequest;
  error?: string;
  data?: unknown;
}

export interface AgentState {
  id: string;
  mode: AgentMode;
  messages: Message[];
  stepCount: number;
  currentStep: AgentStep;
  pendingToolCalls: ToolCall[];
  retryCount: number;
  completed: boolean;
  error?: string;
}

export interface RagHit {
  chunk: IndexChunk;
  score: number;
  pathAffinity: number;
}

export interface ContextRef {
  type: 'file' | 'folder' | 'codebase' | 'selection';
  value: string;
  startLine?: number;
  endLine?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  risk: RiskLevel;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

export interface ToolContext {
  projectRoot: string;
  cwd: string;
  signal?: AbortSignal;
  onFileChange?: (change: FileChange) => void;
  requestApproval?: (req: Omit<ApprovalRequest, 'id' | 'createdAt'>) => Promise<ApprovalDecision>;
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

export interface OpenForgeConfig {
  providers: Partial<Record<ProviderId, ProviderConfig>>;
  shortcuts?: Record<string, string>;
  theme?: 'light' | 'dark' | 'system';
  locale?: string;
  permissions?: {
    autoApproveSafe?: boolean;
    autoApproveLow?: boolean;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  mode: AgentMode;
  model?: string;
  createdAt: number;
  updatedAt: number;
}

export interface InlineCompletionRequest {
  filePath: string;
  prefix: string;
  suffix: string;
  language?: string;
  cursorLine: number;
  cursorColumn: number;
}

export interface InlineCompletionResult {
  text: string;
  cached: boolean;
}

export interface AuditEntry {
  timestamp: number;
  action: string;
  actor?: string;
  details: Record<string, unknown>;
}

export type RolePreset = 'reviewer' | 'tester' | 'architect' | 'default';
