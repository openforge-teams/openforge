import { redactSecrets } from '../security/secrets.js';
import type { Message, TokenUsage } from '../types.js';
import { providerHeaders, type ResolvedProvider } from './providers.js';

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string | null;
    name?: string;
    tool_call_id?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string | null; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface StreamChunk {
  delta: { role?: string; content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> };
  finishReason?: string | null;
}

export class ModelClient {
  private usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor(private readonly provider: ResolvedProvider) {}

  getTokenUsage(): TokenUsage {
    return { ...this.usage };
  }

  resetTokenUsage(): void {
    this.usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  async chatCompletion(
    request: ChatCompletionRequest,
    signal?: AbortSignal,
  ): Promise<ChatCompletionResponse> {
    const url = `${this.provider.baseURL.replace(/\/$/, '')}/chat/completions`;
    const response = await this.fetch(url, {
      method: 'POST',
      headers: providerHeaders(this.provider),
      body: JSON.stringify({ ...request, stream: false }),
      signal,
    });

    const data = (await response.json()) as ChatCompletionResponse;
    this.accumulateUsage(data.usage);
    return data;
  }

  async *chatCompletionStream(
    request: ChatCompletionRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamChunk> {
    const url = `${this.provider.baseURL.replace(/\/$/, '')}/chat/completions`;
    const response = await this.fetch(url, {
      method: 'POST',
      headers: providerHeaders(this.provider),
      body: JSON.stringify({ ...request, stream: true }),
      signal,
    });

    if (!response.body) {
      throw new Error('Streaming response has no body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') return;

          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: StreamChunk['delta']; finish_reason?: string | null }>;
              usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
            };
            const choice = parsed.choices?.[0];
            if (choice?.delta) {
              yield { delta: choice.delta, finishReason: choice.finish_reason };
            }
            if (parsed.usage) {
              this.accumulateUsage(parsed.usage);
            }
          } catch {
            // skip malformed SSE chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async fimCompletion(
    prefix: string,
    suffix: string,
    model: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const url = `${this.provider.baseURL.replace(/\/$/, '')}/completions`;
    const fimPrompt = `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;

    try {
      const response = await this.fetch(url, {
        method: 'POST',
        headers: providerHeaders(this.provider),
        body: JSON.stringify({
          model,
          prompt: fimPrompt,
          max_tokens: 256,
          temperature: 0.2,
          stop: ['<|fim_suffix|>', '<|fim_middle|>', '<|endoftext|>'],
        }),
        signal,
      });

      const data = (await response.json()) as {
        choices?: Array<{ text?: string }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      this.accumulateUsage(data.usage);
      const text = data.choices?.[0]?.text ?? '';
      if (text.trim()) return text;
    } catch {
      // fall through to chat fallback
    }

    return this.chatFimFallback(prefix, suffix, model, signal);
  }

  private async chatFimFallback(
    prefix: string,
    suffix: string,
    model: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const messages: Message[] = [
      {
        id: 'fim-system',
        role: 'system',
        content: 'Complete the code at the cursor. Return only the inserted code, no explanation.',
        createdAt: Date.now(),
      },
      {
        id: 'fim-user',
        role: 'user',
        content: `PREFIX:\n${prefix}\n\nSUFFIX:\n${suffix}\n\nComplete the missing middle code.`,
        createdAt: Date.now(),
      },
    ];

    const response = await this.chatCompletion(
      {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.2,
        max_tokens: 256,
      },
      signal,
    );

    return response.choices[0]?.message?.content ?? '';
  }

  private accumulateUsage(usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): void {
    if (!usage) return;
    this.usage.promptTokens += usage.prompt_tokens;
    this.usage.completionTokens += usage.completion_tokens;
    this.usage.totalTokens += usage.total_tokens;
  }

  private async fetch(url: string, init: RequestInit): Promise<Response> {
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          redactSecrets(`HTTP ${response.status}: ${body.slice(0, 500)}`),
        );
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(redactSecrets(message));
    }
  }
}

export function messagesToApi(messages: Message[]): ChatCompletionRequest['messages'] {
  return messages.map((m) => {
    const base: ChatCompletionRequest['messages'][number] = {
      role: m.role,
      content: m.content,
    };
    if (m.name) base.name = m.name;
    if (m.toolCallId) base.tool_call_id = m.toolCallId;
    if (m.toolCalls?.length) {
      base.tool_calls = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments ?? {}),
        },
      }));
      // OpenAI-compatible APIs allow null content when tool_calls are present
      if (!m.content) base.content = null;
    }
    return base;
  });
}
