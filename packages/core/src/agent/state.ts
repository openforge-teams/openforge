import { v4 as uuidv4 } from 'uuid';
import type { AgentMode, AgentState, AgentStep, Message, RolePreset, ToolCall } from '../types.js';

export const MAX_AGENT_STEPS = 20;
export const MAX_RETRIES = 3;

export function createInitialState(mode: AgentMode = 'agent'): AgentState {
  return {
    id: uuidv4(),
    mode,
    messages: [],
    stepCount: 0,
    currentStep: 'plan',
    pendingToolCalls: [],
    retryCount: 0,
    completed: false,
  };
}

export function serializeState(state: AgentState): string {
  return JSON.stringify(state);
}

export function deserializeState(json: string): AgentState {
  return JSON.parse(json) as AgentState;
}

export function transitionStep(state: AgentState, step: AgentStep): AgentState {
  return { ...state, currentStep: step };
}

export function incrementStep(state: AgentState): AgentState {
  return {
    ...state,
    stepCount: state.stepCount + 1,
    retryCount: 0,
  };
}

export function addMessage(state: AgentState, message: Message): AgentState {
  return {
    ...state,
    messages: [...state.messages, message],
  };
}

export function setPendingToolCalls(state: AgentState, calls: ToolCall[]): AgentState {
  return { ...state, pendingToolCalls: calls, currentStep: 'tool_call' };
}

export function clearPendingToolCalls(state: AgentState): AgentState {
  return { ...state, pendingToolCalls: [], currentStep: 'validate' };
}

export function markComplete(state: AgentState): AgentState {
  return { ...state, completed: true, currentStep: 'complete' };
}

export function markError(state: AgentState, error: string): AgentState {
  return { ...state, error, currentStep: 'error', completed: true };
}

export function canContinue(state: AgentState): boolean {
  return !state.completed && state.stepCount < MAX_AGENT_STEPS;
}

export function shouldRetry(state: AgentState): boolean {
  return state.retryCount < MAX_RETRIES;
}

export function incrementRetry(state: AgentState): AgentState {
  return {
    ...state,
    retryCount: state.retryCount + 1,
    currentStep: 'retry',
  };
}

export const ROLE_PRESETS: Record<RolePreset, string> = {
  default: 'You are a helpful AI coding assistant.',
  reviewer: 'You are a senior code reviewer. Focus on correctness, security, performance, and maintainability. Be concise and actionable.',
  tester: 'You are a QA engineer. Focus on test coverage, edge cases, and reproducible steps. Prefer writing tests over speculation.',
  architect: 'You are a software architect. Focus on system design, trade-offs, scalability, and clean boundaries between modules.',
};

export function systemPromptForRole(preset: RolePreset, mode: AgentMode): string {
  const base = ROLE_PRESETS[preset];
  const modeHint =
    mode === 'plan'
      ? 'You are in PLAN mode: analyze and propose plans without making file changes.'
      : mode === 'ask'
        ? 'You are in ASK mode: read-only exploration and Q&A, no writes.'
        : 'You are in AGENT mode: you may use tools to read and modify the codebase.';

  return `${base}\n\n${modeHint}`;
}
