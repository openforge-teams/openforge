# OpenForge

开源 AI 编程助手 —— 融合 Cursor 式 IDE 体验与 Claude Code 式自主 Agent，支持桌面端 / CLI / VS Code 扩展，本地优先，多模型兼容。

**本地运行 · 开源免费 · 对标 Cursor / Claude Code · 兼容 MCP / OpenAI / Ollama / 火山引擎**

## 功能概览

| 能力 | 说明 |
|------|------|
| 桌面 IDE | Monaco 编辑器、文件树、内置终端、侧边对话、Diff / 审批 |
| 智能补全 | FIM 行内 Ghost Text、内联编辑（Ctrl+K） |
| Agent | ReAct 闭环、多文件修改、终端执行、Plan / Ask / Agent 模式 |
| RAG 索引 | 项目语义检索、`.aiignore`、规则系统 |
| 模型 | OpenAI 兼容 API、Ollama、火山引擎方舟（Ark） |
| 安全 | Diff 预览、操作审批、检查点回滚、命令黑名单、敏感信息脱敏 |
| MCP | stdio MCP 服务器接入 |
| 多端 | Desktop（Tauri）· CLI · VS Code 扩展 |

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 9+
- Rust（桌面端 Tauri 打包需要）
- Windows 10+ / macOS 12+ / Linux（Ubuntu 20.04+）

### 安装

```bash
git clone <repo> openforge
cd openforge
cp .env.example .env   # 填入 API Key
pnpm install
pnpm --filter @openforge/core build
```

### 启动 Web / 开发模式（无需 Tauri）

```bash
pnpm dev:web
```

### 启动桌面端（Tauri）

```bash
pnpm dev:desktop
```

### CLI

```bash
pnpm --filter @openforge/cli build
pnpm cli agent "给当前项目加一个 hello 接口"
# 或
npx openforge ask "这个仓库的入口在哪？"
```

### VS Code 扩展

```bash
cd extensions/vscode
pnpm install
# 在 VS Code 中按 F5 调试运行
```

## 模型配置

编辑 `~/.openforge/config.json` 或项目 `.ai/config.json`，或使用环境变量：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | OpenAI 兼容端点 |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | 本地 Ollama |
| `VOLCENGINE_API_KEY` / `VOLCENGINE_BASE_URL` / `VOLCENGINE_MODEL` | 火山引擎方舟 |

火山引擎默认 Base URL：`https://ark.cn-beijing.volces.com/api/v3`（OpenAI Chat Completions 兼容）。

## Windows 安装包

在 Windows 或 CI 上：

```bash
pnpm build:desktop
# 产物位于 apps/desktop/src-tauri/target/release/bundle/
# 含 NSIS / MSI
```

GitHub Actions 工作流见 `.github/workflows/release.yml`。

## 项目结构

```
apps/desktop     Tauri + React IDE
apps/cli         终端 Agent
packages/core    Agent / 模型 / RAG / 工具 / 安全
extensions/vscode
docs/            配置与贡献文档
```

## 文档

- [配置手册](docs/configuration.md)
- [贡献指南](docs/CONTRIBUTING.md)
- [常见问题](docs/FAQ.md)
- [路线图](docs/ROADMAP.md)

## License

MIT
