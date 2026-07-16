# OpenForge 配置手册

## 配置文件层级

1. 环境变量（最高优先级覆盖密钥类）
2. `~/.openforge/config.json`（全局）
3. `<project>/.ai/config.json`（项目）

## 示例 `~/.openforge/config.json`

```json
{
  "locale": "zh",
  "theme": "dark",
  "defaultProvider": "volcengine",
  "providers": {
    "openai": {
      "apiKey": "",
      "baseURL": "https://api.openai.com/v1",
      "models": { "chat": "gpt-4o-mini", "completion": "gpt-4o-mini", "agent": "gpt-4o" }
    },
    "ollama": {
      "apiKey": "ollama",
      "baseURL": "http://127.0.0.1:11434/v1",
      "models": { "chat": "qwen2.5-coder:7b", "completion": "qwen2.5-coder:7b", "agent": "qwen2.5-coder:14b" }
    },
    "volcengine": {
      "apiKey": "<ARK_API_KEY>",
      "baseURL": "https://ark.cn-beijing.volces.com/api/v3",
      "models": {
        "chat": "<endpoint-id>",
        "completion": "<endpoint-id>",
        "agent": "<endpoint-id>"
      }
    }
  },
  "permissions": {
    "autoApproveSafe": true,
    "autoApproveLow": false,
    "projectOnly": true,
    "commandBlacklist": ["rm -rf /", "mkfs", "format", "shutdown"]
  },
  "agent": {
    "maxSteps": 20,
    "maxRetries": 3
  }
}
```

## 火山引擎（方舟 Ark）

1. 在[火山引擎方舟控制台](https://console.volcengine.com/ark)创建推理接入点，获得 **API Key** 与 **Endpoint ID**（作为 model 名）。
2. 设置：

```bash
export VOLCENGINE_API_KEY=your_key
export VOLCENGINE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
export VOLCENGINE_MODEL=ep-xxxxxxxx
export OPENFORGE_DEFAULT_PROVIDER=volcengine
```

请求走 OpenAI 兼容路径：`POST {baseURL}/chat/completions`，Header：`Authorization: Bearer <API_KEY>`。

## 规则文件

| 路径 | 说明 |
|------|------|
| `~/.openforge/rules.md` | 全局个人规则 |
| `.ai/rules.md` | 项目规则 |
| `.cursorrules` / `AGENTS.md` | 兼容读取 |
| `.aiignore` | 索引忽略（语法同 gitignore） |

## MCP

项目 `.ai/mcp.json`：

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

## 快捷键（桌面端默认）

| 快捷键 | 功能 |
|--------|------|
| Ctrl+L | 打开对话 |
| Ctrl+K | 内联编辑 |
| Ctrl+I | Agent |
| Ctrl+` | 终端 |
| Tab | 接受补全 |
| Esc | 取消补全 / 关闭弹层 |
