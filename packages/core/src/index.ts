// Types
export type {
  Role,
  AgentMode,
  ProviderId,
  RiskLevel,
  ApprovalDecision,
  AgentStep,
  AgentEventType,
  Message,
  ToolCall,
  ToolResult,
  ModelConfig,
  ProviderConfig,
  TokenUsage,
  FileChange,
  Checkpoint,
  ApprovalRequest,
  IndexChunk,
  RuleSet,
  SlashCommand,
  CommandContext,
  AgentEvent,
  AgentState,
  RagHit,
  ContextRef,
  ToolDefinition,
  ToolContext,
  McpServerConfig,
  McpConfig,
  OpenForgeConfig,
  ChatSession,
  InlineCompletionRequest,
  InlineCompletionResult,
  AuditEntry,
  RolePreset,
} from './types.js';

// Models
export {
  DEFAULT_BASE_URLS,
  resolveProvider,
  providerHeaders,
  type ResolvedProvider,
} from './models/providers.js';
export {
  ModelClient,
  messagesToApi,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type StreamChunk,
} from './models/client.js';
export {
  ModelRouter,
  type ModelTask,
  type ModelRouterOptions,
} from './models/router.js';

// Context
export {
  CodeIndexer,
  relativePath,
  type IndexerOptions,
} from './context/indexer.js';
export {
  tokenize,
  termFrequency,
  cosineSimilarity,
  keywordScore,
  pathAffinity,
  searchChunks,
  formatRagHits,
  type RagOptions,
} from './context/rag.js';
export {
  loadRules,
  mergeRules,
  getMergedRules,
} from './context/rules.js';
export {
  assembleContext,
  parseRefs,
  ragHitsToContext,
  type AssembleContextOptions,
} from './context/assemble.js';

// Agent
export {
  AgentEngine,
  MAX_AGENT_STEPS,
  MAX_RETRIES,
  type AgentEngineOptions,
  type SubAgentResult,
} from './agent/engine.js';
export {
  buildPlanningPrompt,
  parsePlanResponse,
  planToUserMessage,
  type PlanResult,
} from './agent/planner.js';
export {
  createInitialState,
  serializeState,
  deserializeState,
  transitionStep,
  incrementStep,
  addMessage,
  setPendingToolCalls,
  clearPendingToolCalls,
  markComplete,
  markError,
  canContinue,
  shouldRetry,
  incrementRetry,
  ROLE_PRESETS,
  systemPromptForRole,
} from './agent/state.js';

// Tools
export {
  createBuiltinTools,
  registerBuiltinTools,
} from './tools/builtin.js';
export {
  ToolRegistry,
  globalToolRegistry,
} from './tools/registry.js';
export {
  McpClient,
  loadMcpConfig,
  connectMcpServers,
} from './tools/mcp.js';

// Security
export {
  ApprovalQueue,
  type ApprovalPolicy,
} from './security/approvals.js';
export {
  validateCommand,
  sanitizePath,
  isReadOnlyMode,
  blocksWrite,
  type SandboxResult,
} from './security/sandbox.js';
export {
  CheckpointManager,
  snapshotFile,
  copyToCheckpoint,
} from './security/checkpoint.js';
export { AuditLog } from './security/audit.js';
export {
  redactSecrets,
  containsSecret,
  maskValue,
} from './security/secrets.js';

// Completion
export {
  InlineCompletionEngine,
  buildInlinePrompt,
  buildCacheKey,
  parseGhostText,
  buildNearbyContext,
} from './completion/inline.js';

// Chat
export { SessionManager } from './chat/session.js';
export {
  createSlashCommands,
  parseSlashCommand,
  executeSlashCommand,
  applyModeCommand,
  type CommandHandlers,
} from './chat/commands.js';

// Config
export {
  ConfigStore,
  mergeConfigs,
  defaultConfigStore,
} from './config/store.js';
