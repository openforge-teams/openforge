/**
 * Browser-safe exports for the desktop UI (no node:fs / child_process).
 * Full Agent / indexer / MCP remain Node/CLI/Tauri-sidecar concerns.
 */

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
  ApprovalRequest,
  IndexChunk,
  SlashCommand,
  AgentEvent,
  AgentState,
  RagHit,
  ContextRef,
  ChatSession,
  InlineCompletionRequest,
  InlineCompletionResult,
  RolePreset,
} from './types.js';

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

export {
  InlineCompletionEngine,
  buildInlinePrompt,
  buildCacheKey,
  parseGhostText,
  buildNearbyContext,
} from './completion/inline.js';

export {
  redactSecrets,
  containsSecret,
  maskValue,
} from './security/secrets.js';

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
