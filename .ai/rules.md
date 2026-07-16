# OpenForge Project Rules

- Prefer TypeScript strict mode and clear module boundaries.
- Keep `@openforge/core` free of UI dependencies.
- Desktop browser bundle must import `@openforge/core/browser` only.
- Never commit API keys or `.env` files.
- Dangerous shell commands require explicit user approval.
