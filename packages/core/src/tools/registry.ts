import type { ToolDefinition } from '../types.js';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private mcpTools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerMcp(tool: ToolDefinition, serverName: string): void {
    const name = `mcp_${serverName}_${tool.name}`;
    this.mcpTools.set(name, { ...tool, name });
    this.tools.set(name, { ...tool, name });
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  listByRisk(maxRisk: 'safe' | 'low' | 'high'): ToolDefinition[] {
    const order = { safe: 0, low: 1, high: 2 };
    const max = order[maxRisk];
    return this.list().filter((t) => order[t.risk] <= max);
  }

  forMode(mode: 'agent' | 'plan' | 'ask'): ToolDefinition[] {
    if (mode === 'ask') {
      return this.list().filter((t) =>
        ['read_file', 'list_dir', 'search_code', 'git_status', 'git_diff', 'git_log'].includes(t.name) ||
        t.risk === 'safe',
      );
    }
    if (mode === 'plan') {
      return this.list().filter((t) => t.risk !== 'high' || ['read_file', 'list_dir', 'search_code', 'git_status', 'git_diff', 'git_log'].includes(t.name));
    }
    return this.list();
  }

  toOpenAITools(tools?: ToolDefinition[]): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    const list = tools ?? this.list();
    return list.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  unregister(name: string): boolean {
    this.mcpTools.delete(name);
    return this.tools.delete(name);
  }

  clearMcp(): void {
    for (const name of this.mcpTools.keys()) {
      this.tools.delete(name);
    }
    this.mcpTools.clear();
  }
}

export const globalToolRegistry = new ToolRegistry();
