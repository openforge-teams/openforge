# Changelog

## 0.1.1 — 2026-07-16

### Fixed
- Agent approval bypass: remove hardcoded auto-approve; deny high-risk tools without a host prompt
- Multi-turn agent loop: serialize `tool_calls` in `messagesToApi`
- Safe JSON parsing for malformed model tool arguments
- Agent first-turn vs follow-up context (no duplicate system prompts)
- RAG chunks injected into agent context on first turn
- MCP tool registration awaited before agent runs (CLI + VS Code)
- Checkpoint tool captures agent file changes
- Approval queue dequeues resolved requests
- CLI REPL persists full message history from agent state
- VS Code interactive approval dialog for high-risk tools
- Desktop: persist "always allow", terminal cwd, settings draft refresh

### Added
- Unit tests for `messagesToApi` and `ApprovalQueue`

## 0.1.0 — 2026-07-16

### Added
- Monorepo: `@openforge/core`, desktop (Tauri + React), CLI, VS Code extension
- Model providers: OpenAI-compatible, Ollama, 火山引擎方舟 (Ark)
- Agent ReAct engine with Plan / Ask / Agent modes, sub-agents, role presets
- Code indexer + RAG, rules, `.aiignore`
- Built-in tools, MCP stdio client, approvals, checkpoints, audit, secret redaction
- Desktop IDE: Monaco, explorer, chat, ghost completion, inline edit, terminal, diff/approval modals
- Windows NSIS/MSI bundle targets + GitHub Actions release workflow
- Docs: configuration, FAQ, contributing, roadmap
