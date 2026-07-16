import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { McpConfig, McpServerConfig, ToolDefinition } from '../types.js';
import { globalToolRegistry } from './registry.js';

const mcpConfigSchema = z.object({
  servers: z.record(
    z.object({
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(),
    }),
  ),
});

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export class McpClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private buffer = '';
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(
    private readonly name: string,
    private readonly config: McpServerConfig,
  ) {}

  async connect(): Promise<void> {
    this.proc = spawn(this.config.command, this.config.args ?? [], {
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout.on('data', (chunk: Buffer) => this.onData(chunk.toString()));
    this.proc.stderr.on('data', () => {
      // MCP servers may log to stderr
    });

    this.proc.on('close', () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`MCP server "${this.name}" closed`));
      }
      this.pending.clear();
    });

    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'openforge', version: '0.1.0' },
    });

    await this.notify('notifications/initialized', {});
  }

  async listTools(): Promise<Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>> {
    const result = (await this.request('tools/list', {})) as {
      tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>;
    };
    return result.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = (await this.request('tools/call', { name, arguments: args })) as {
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };

    const text = result.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n');

    if (result.isError) {
      throw new Error(text ?? 'MCP tool error');
    }

    return text ?? JSON.stringify(result);
  }

  async registerTools(registry = globalToolRegistry): Promise<void> {
    const tools = await this.listTools();
    for (const tool of tools) {
      const def: ToolDefinition = {
        name: tool.name,
        description: tool.description ?? `MCP tool ${tool.name}`,
        parameters: tool.inputSchema ?? { type: 'object', properties: {} },
        risk: 'low',
        execute: async (arguments_, ctx) => {
          if (ctx.signal?.aborted) throw new Error('Aborted');
          return this.callTool(tool.name, arguments_);
        },
      };
      registry.registerMcp(def, this.name);
    }
  }

  close(): void {
    this.proc?.kill();
    this.proc = null;
  }

  private onData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        if (msg.id !== undefined) {
          const pending = this.pending.get(msg.id);
          if (pending) {
            this.pending.delete(msg.id);
            if (msg.error) pending.reject(new Error(msg.error.message));
            else pending.resolve(msg.result);
          }
        }
      } catch {
        // ignore non-json lines
      }
    }
  }

  private send(msg: JsonRpcRequest | { jsonrpc: '2.0'; method: string; params?: Record<string, unknown> }): void {
    if (!this.proc?.stdin.writable) {
      throw new Error(`MCP server "${this.name}" is not connected`);
    }
    this.proc.stdin.write(`${JSON.stringify(msg)}\n`);
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  private notify(method: string, params: Record<string, unknown>): Promise<void> {
    this.send({ jsonrpc: '2.0', method, params });
    return Promise.resolve();
  }
}

export async function loadMcpConfig(projectRoot: string): Promise<McpConfig> {
  try {
    const raw = await readFile(join(projectRoot, '.ai', 'mcp.json'), 'utf8');
    return mcpConfigSchema.parse(JSON.parse(raw));
  } catch {
    return { servers: {} };
  }
}

export async function connectMcpServers(
  projectRoot: string,
  registry = globalToolRegistry,
): Promise<McpClient[]> {
  const config = await loadMcpConfig(projectRoot);
  const clients: McpClient[] = [];

  registry.clearMcp();

  for (const [name, serverConfig] of Object.entries(config.servers)) {
    const client = new McpClient(name, serverConfig);
    try {
      await client.connect();
      await client.registerTools(registry);
      clients.push(client);
    } catch (err) {
      console.error(`Failed to connect MCP server "${name}":`, err);
    }
  }

  return clients;
}
