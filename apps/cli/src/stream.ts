import type { AgentEvent } from '@openforge/core';
import { ansi, color } from './colors.js';

export function printEvent(event: AgentEvent): void {
  switch (event.type) {
    case 'step':
      console.log(color(`→ ${event.step ?? 'step'}`, ansi.blue));
      break;
    case 'message': {
      const msg = event.message;
      if (!msg) break;
      const roleColor =
        msg.role === 'assistant' ? ansi.green
        : msg.role === 'user' ? ansi.cyan
        : msg.role === 'tool' ? ansi.magenta
        : ansi.gray;
      const label = msg.role === 'assistant' ? 'Assistant' : msg.role;
      console.log(color(`\n[${label}]`, roleColor + ansi.bold));
      if (msg.content) console.log(msg.content);
      if (msg.toolCalls?.length) {
        for (const tc of msg.toolCalls) {
          console.log(color(`  ▸ ${tc.name}(${JSON.stringify(tc.arguments)})`, ansi.dim));
        }
      }
      break;
    }
    case 'tool_call':
      console.log(
        color(`  ▸ ${event.toolCall?.name ?? 'tool'}`, ansi.yellow),
        color(JSON.stringify(event.toolCall?.arguments ?? {}), ansi.gray),
      );
      break;
    case 'tool_result': {
      const result = event.toolResult;
      if (!result) break;
      const prefix = result.isError ? color('✗', ansi.red) : color('✓', ansi.green);
      const preview = result.content.length > 500
        ? `${result.content.slice(0, 500)}…`
        : result.content;
      console.log(`${prefix} ${result.name}: ${color(preview, ansi.dim)}`);
      break;
    }
    case 'error':
      console.error(color(`Error: ${event.error}`, ansi.red));
      break;
    case 'done':
      console.log(color('\n✓ Done', ansi.green + ansi.bold));
      break;
    case 'approval':
      break;
  }
}

export async function streamAgent(
  generator: AsyncGenerator<AgentEvent>,
): Promise<void> {
  for await (const event of generator) {
    printEvent(event);
    if (event.type === 'error') {
      process.exitCode = 1;
      return;
    }
  }
}
