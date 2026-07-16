# OpenForge VS Code Extension

AI coding assistant for VS Code, powered by [`@openforge/core`](../../packages/core).

## Features

- **Chat panel** — Activity bar webview for interactive agent chat
- **Inline edit** — Select code and apply AI edits (`Ctrl+K` / `Cmd+K`)
- **Run agent** — One-shot agent task on selection or prompt (`Ctrl+I` / `Cmd+I`)
- **Settings** — Configure provider and model via VS Code settings

## Commands

| Command | Keybinding |
|---------|-------------|
| OpenForge: Open Chat | `Ctrl+L` / `Cmd+L` |
| OpenForge: Inline Edit | `Ctrl+K` / `Cmd+K` |
| OpenForge: Run Agent | `Ctrl+I` / `Cmd+I` |
| OpenForge: Settings | — |

## Development

```bash
pnpm --filter openforge-vscode build
```

Load the `extensions/vscode` folder in VS Code's Extension Development Host.

## Configuration

- `openforge.defaultProvider` — `openai`, `ollama`, or `volcengine`
- `openforge.model` — optional model override

Set API keys via environment variables (`OPENAI_API_KEY`, etc.) or project `.env`.
