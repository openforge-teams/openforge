<p align="center">
  <img src="docs/assets/logo.png" alt="OpenForge" width="168" />
</p>

<h1 align="center">OpenForge</h1>

<p align="center">
  <strong>本地优先的开源 AI 编程助手</strong><br />
  现代 IDE 体验与自主 Agent 能力合而为一<br />
  Desktop · CLI · VS Code — 一套引擎，三端齐发
</p>

<p align="center">
  <a href="#快速开始"><img src="https://img.shields.io/badge/Get_Started-快速开始-0EA5E9?style=for-the-badge" alt="Get Started" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge" alt="MIT" /></a>
  <a href="docs/ROADMAP.md"><img src="https://img.shields.io/badge/Status-v0.1.0-F59E0B?style=for-the-badge" alt="Status" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/pnpm-9+-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm" />
  <img src="https://img.shields.io/badge/Tauri-2-FFC131?style=flat-square&logo=tauri&logoColor=black" alt="Tauri" />
  <img src="https://img.shields.io/badge/OpenAI-Compatible-412991?style=flat-square&logo=openai&logoColor=white" alt="OpenAI" />
  <img src="https://img.shields.io/badge/Ollama-Local-000000?style=flat-square" alt="Ollama" />
  <img src="https://img.shields.io/badge/Volcengine-Ark-1664FF?style=flat-square" alt="Volcengine" />
  <img src="https://img.shields.io/badge/MCP-Ready-7C3AED?style=flat-square" alt="MCP" />
</p>

---

## 为什么是 OpenForge

大多数 AI 编程工具要么锁在云端 IDE，要么只给一条 CLI。OpenForge 把二者合在一起：

| | 你得到的 |
|---|---|
| **完整 IDE** | Monaco、文件树、终端、侧边对话、Diff 与审批流 |
| **真正的 Agent** | ReAct 闭环、多文件修改、Plan / Ask / Agent 三模式 |
| **本地优先** | 代码与密钥留在本机；可选云端模型或纯本地 Ollama |
| **开放生态** | OpenAI 兼容 API · Ollama · 火山引擎方舟 · MCP stdio |

> 锻造复杂能力，交付轻盈体验 —— OpenForge 让 AI 编程像在水中游动一样顺畅。

---

## 能力全景

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>Desktop IDE</h3>
      <ul>
        <li>Monaco 编辑器 + 资源管理器</li>
        <li>内置终端与侧边对话</li>
        <li>Ghost Text 补全 / Ctrl+K 内联编辑</li>
        <li>Diff 预览与操作审批</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>Agent Runtime</h3>
      <ul>
        <li>ReAct 规划 → 工具 → 观察循环</li>
        <li>多文件读写与终端执行</li>
        <li>Plan / Ask / Agent 模式切换</li>
        <li>检查点回滚与审计日志</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>Context &amp; RAG</h3>
      <ul>
        <li>项目语义索引与检索</li>
        <li><code>.aiignore</code> 与规则系统</li>
        <li>项目级 <code>.ai/config.json</code></li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>多端与扩展</h3>
      <ul>
        <li>Tauri 桌面端（Win / macOS / Linux）</li>
        <li>终端 CLI：<code>agent</code> / <code>plan</code> / <code>ask</code></li>
        <li>VS Code 扩展宿主</li>
        <li>MCP 服务器接入</li>
      </ul>
    </td>
  </tr>
</table>

---

## 快速开始

### 环境要求

- **Node.js** 20+
- **pnpm** 9+
- **Rust**（仅 Tauri 桌面打包需要）
- Windows 10+ / macOS 12+ / Linux（Ubuntu 20.04+）

### 安装

```bash
git clone https://github.com/openforge-studio/openforge.git
cd openforge
cp .env.example .env   # 填入你的 API Key
pnpm install
pnpm --filter @openforge/core build
```

### 启动

```bash
# Web 开发模式（无需 Tauri）
pnpm dev:web

# 桌面端（Tauri）
pnpm dev:desktop

# CLI
pnpm --filter @openforge/cli build
pnpm cli agent "给当前项目加一个 hello 接口"
# 或
npx openforge ask "这个仓库的入口在哪？"
```

### 打包桌面安装包（Tauri 2）

```bash
pnpm --filter @openforge/core build
pnpm build:desktop
```

macOS 产物默认在：

```text
apps/desktop/src-tauri/target/release/bundle/macos/OpenForge.app
```

仅打 `.app`（跳过 DMG）：

```bash
cd apps/desktop && pnpm exec tauri build --bundles app
```

Windows / Linux 分别在对应系统执行同样命令，产物为 NSIS/MSI 或 Deb 等安装包。

### VS Code 扩展

```bash
cd extensions/vscode
pnpm install
# 在 VS Code 中按 F5 调试运行
```

---

## 模型配置

OpenForge 对模型层保持中立。编辑 `~/.openforge/config.json`、项目 `.ai/config.json`，或使用环境变量：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | OpenAI 及兼容端点 |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | 本地 Ollama |
| `VOLCENGINE_API_KEY` / `VOLCENGINE_BASE_URL` / `VOLCENGINE_MODEL` | 火山引擎方舟 |

火山引擎默认 Base URL：`https://ark.cn-beijing.volces.com/api/v3`（Chat Completions 兼容）。

完整说明见 → [配置手册](docs/configuration.md)

---

## 安全设计

AI 写代码必须可控。OpenForge 内置：

- **Diff 预览** — 改动先看清，再落地  
- **操作审批** — 高风险命令显式确认  
- **检查点回滚** — 一键回到安全点  
- **命令黑名单** — 危险 shell 默认拦截  
- **敏感信息脱敏** — 日志与输出中屏蔽密钥  

---

## Windows 安装包

在 Windows 或 CI 上构建：

```bash
pnpm build:desktop
# 产物：apps/desktop/src-tauri/target/release/bundle/
# 含 NSIS / MSI
```

GitHub Actions 模板：[`docs/ci/release.yml`](docs/ci/release.yml)（复制到 `.github/workflows/` 后启用）。

---

## 仓库结构

```
openforge/
├── apps/
│   ├── desktop/          # Tauri + React IDE
│   └── cli/              # 终端 Agent
├── packages/
│   └── core/             # Agent · 模型 · RAG · 工具 · 安全
├── extensions/
│   └── vscode/           # VS Code 扩展
└── docs/                 # 配置、贡献、路线图
```

---

## 文档

| 文档 | 内容 |
|------|------|
| [配置手册](docs/configuration.md) | 提供商、环境变量、项目配置 |
| [贡献指南](docs/CONTRIBUTING.md) | 开发流程与 PR 规范 |
| [常见问题](docs/FAQ.md) | 安装与使用排障 |
| [路线图](docs/ROADMAP.md) | 已实现能力与后续规划 |

---

## 理念

<p align="center">
  <img src="docs/assets/logo.png" alt="OpenForge mascot" width="96" />
</p>

<p align="center">
  <em>Forge the hard parts. Ship the fluid experience.</em><br />
  开源、本地优先、多模型兼容 —— 把 AI 编程助手交还给开发者自己。
</p>

---

## License

Released under the [MIT License](LICENSE).
