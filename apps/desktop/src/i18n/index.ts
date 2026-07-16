export type Locale = 'en' | 'zh';

export const en = {
  app: { title: 'OpenForge' },
  activity: {
    explorer: 'Explorer',
    search: 'Search',
    git: 'Git',
    agent: 'Agent',
    settings: 'Settings',
  },
  explorer: {
    openFolder: 'Open Folder',
    noFolder: 'No folder opened',
    empty: 'Empty folder',
  },
  editor: {
    untitled: 'Untitled',
    inlineEdit: 'Inline Edit (Ctrl+K)',
    acceptCompletion: 'Tab to accept',
    dismissCompletion: 'Esc to dismiss',
    promptPlaceholder: 'Describe the change...',
    accept: 'Accept',
    reject: 'Reject',
  },
  chat: {
    title: 'Chat',
    placeholder: 'Ask anything... (@ files, /commands)',
    send: 'Send',
    modes: { agent: 'Agent', plan: 'Plan', ask: 'Ask' },
    copy: 'Copy',
    insert: 'Insert',
    diff: 'Diff',
    thinking: 'Thinking...',
  },
  agent: {
    title: 'Agent',
    steps: 'Steps',
    progress: 'Progress',
    interrupt: 'Interrupt',
    idle: 'Idle',
    running: 'Running',
    completed: 'Completed',
    error: 'Error',
    noSteps: 'No agent activity yet',
  },
  terminal: {
    title: 'Terminal',
    webNote: 'Web mode: simulated local echo. Shell available in Tauri build.',
    placeholder: 'Type a command...',
  },
  settings: {
    title: 'Settings',
    providers: 'AI Providers',
    openai: 'OpenAI',
    ollama: 'Ollama',
    volcengine: 'Volcengine (火山引擎)',
    apiKey: 'API Key',
    baseUrl: 'Base URL',
    chatModel: 'Chat Model',
    completionModel: 'Completion Model',
    agentModel: 'Agent Model',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    locale: 'Language',
    save: 'Save',
    cancel: 'Cancel',
  },
  approval: {
    title: 'Approval Required',
    once: 'Approve Once',
    always: 'Always Allow',
    deny: 'Deny',
    queue: 'Approval Queue',
    empty: 'No pending approvals',
  },
  diff: {
    title: 'Review Changes',
    accept: 'Accept',
    reject: 'Reject',
  },
  palette: {
    title: 'Command Palette',
    placeholder: 'Type a command...',
  },
  status: {
    ready: 'Ready',
    tokens: 'tokens',
    line: 'Ln',
    col: 'Col',
  },
  shortcuts: {
    chat: 'Focus Chat',
    inlineEdit: 'Inline Edit',
    agent: 'Agent Panel',
    terminal: 'Toggle Terminal',
    palette: 'Command Palette',
  },
};

type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type Dict = DeepString<typeof en>;

export const zh: Dict = {
  app: { title: 'OpenForge' },
  activity: {
    explorer: '资源管理器',
    search: '搜索',
    git: 'Git',
    agent: '智能体',
    settings: '设置',
  },
  explorer: {
    openFolder: '打开文件夹',
    noFolder: '未打开文件夹',
    empty: '空文件夹',
  },
  editor: {
    untitled: '未命名',
    inlineEdit: '行内编辑 (Ctrl+K)',
    acceptCompletion: 'Tab 接受',
    dismissCompletion: 'Esc 取消',
    promptPlaceholder: '描述你想要的修改...',
    accept: '接受',
    reject: '拒绝',
  },
  chat: {
    title: '对话',
    placeholder: '随便问... (@ 文件, /命令)',
    send: '发送',
    modes: { agent: '智能体', plan: '规划', ask: '问答' },
    copy: '复制',
    insert: '插入',
    diff: '对比',
    thinking: '思考中...',
  },
  agent: {
    title: '智能体',
    steps: '步骤',
    progress: '进度',
    interrupt: '中断',
    idle: '空闲',
    running: '运行中',
    completed: '已完成',
    error: '错误',
    noSteps: '暂无智能体活动',
  },
  terminal: {
    title: '终端',
    webNote: 'Web 模式：模拟本地回显。Tauri 构建中可使用真实 Shell。',
    placeholder: '输入命令...',
  },
  settings: {
    title: '设置',
    providers: 'AI 提供商',
    openai: 'OpenAI',
    ollama: 'Ollama',
    volcengine: '火山引擎',
    apiKey: 'API 密钥',
    baseUrl: '接口地址',
    chatModel: '对话模型',
    completionModel: '补全模型',
    agentModel: '智能体模型',
    theme: '主题',
    themeLight: '浅色',
    themeDark: '深色',
    locale: '语言',
    save: '保存',
    cancel: '取消',
  },
  approval: {
    title: '需要批准',
    once: '批准一次',
    always: '始终允许',
    deny: '拒绝',
    queue: '批准队列',
    empty: '无待批准项',
  },
  diff: {
    title: '审查更改',
    accept: '接受',
    reject: '拒绝',
  },
  palette: {
    title: '命令面板',
    placeholder: '输入命令...',
  },
  status: {
    ready: '就绪',
    tokens: '令牌',
    line: '行',
    col: '列',
  },
  shortcuts: {
    chat: '聚焦对话',
    inlineEdit: '行内编辑',
    agent: '智能体面板',
    terminal: '切换终端',
    palette: '命令面板',
  },
};

const dicts: Record<Locale, Dict> = { en, zh };

export function t(locale: Locale, key: string): string {
  const parts = key.split('.');
  let cur: unknown = dicts[locale];
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  return typeof cur === 'string' ? cur : key;
}
