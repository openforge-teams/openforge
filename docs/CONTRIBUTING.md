# 贡献指南

感谢参与 OpenForge！

## 开发

```bash
pnpm install
pnpm --filter @openforge/core build
pnpm dev:web
```

## 包职责

- `packages/core`：引擎与协议，保持可在 Node / CLI / 扩展中复用
- `apps/desktop`：仅 UI 与宿主适配（Tauri / 浏览器 FS）
- `apps/cli`：终端交互
- `extensions/vscode`：VS Code 宿主

## 提交

- 使用清晰的英文或中文 commit message，说明「为什么」
- 新功能尽量附带 `packages/core` 下的单元测试
- 不要提交 `.env`、密钥、本地 `.ai/` 数据

## PR

1. Fork / 建分支
2. 保证 `pnpm typecheck` 与 `pnpm test` 通过
3. 描述变更与测试计划
