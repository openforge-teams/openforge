# 常见问题

## 补全很慢？

优先使用低延迟端点（本地 Ollama 或近地域云 API）。补全模型可单独配置为更小的模型。

## 火山引擎报 401？

确认使用方舟 **API Key**（非其它产品密钥），且 `model` 填的是 **接入点 Endpoint ID**（形如 `ep-xxxx`）。

## 索引很大项目卡顿？

编辑 `.aiignore` 排除 `node_modules`、`dist`、`target`、二进制与数据集；索引在后台增量更新。

## Agent 循环停不住？

默认最大 20 步；可随时中断。高危命令需人工审批。

## Windows 如何打包？

在 Windows 安装 Node 20、Rust、WebView2，然后 `pnpm build:desktop`。或使用仓库 GitHub Actions `release` 工作流产出 NSIS/MSI。
