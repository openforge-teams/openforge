import { useState } from 'react';
import { Copy, FileInput, GitCompare, Send } from 'lucide-react';
import clsx from 'clsx';
import type { AgentMode } from '@openforge/core/browser';
import { messagesToApi } from '@openforge/core/browser';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useEditorStore } from '@/stores/editorStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { getModelRouter, resetModelRouter, getOrCreateSession, getSessionManager } from '@/adapters/core';
import { t } from '@/i18n';

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const locale = useSettingsStore((s) => s.locale);
  const setDiffModal = useEditorStore((s) => s.setDiffModal);
  const updateContent = useEditorStore((s) => s.updateContent);
  const activeTab = useEditorStore((s) => s.getActiveTab());

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{lang}</span>
        <div className="code-block-actions">
          <button className="icon-btn" title={t(locale, 'chat.copy')} onClick={() => navigator.clipboard.writeText(code)}>
            <Copy size={12} />
          </button>
          <button
            className="icon-btn"
            title={t(locale, 'chat.insert')}
            onClick={() => {
              if (activeTab) updateContent(activeTab.id, activeTab.content + '\n' + code);
            }}
          >
            <FileInput size={12} />
          </button>
          <button
            className="icon-btn"
            title={t(locale, 'chat.diff')}
            onClick={() =>
              setDiffModal({
                title: t(locale, 'diff.title'),
                original: activeTab?.content ?? '',
                modified: code,
                onAccept: () => {
                  if (activeTab) updateContent(activeTab.id, code);
                },
              })
            }
          >
            <GitCompare size={12} />
          </button>
        </div>
      </div>
      <pre><code>{code}</code></pre>
      <style>{`
        .code-block {
          margin: 8px 0;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          background: var(--bg-base);
        }
        .code-block-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 8px;
          background: var(--bg-elevated);
          font-size: 10px;
          color: var(--text-muted);
        }
        .code-block-actions { display: flex; gap: 2px; }
        .code-block pre {
          padding: 8px 12px;
          font-family: var(--font-mono);
          font-size: 12px;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
}

function renderMessageContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    const match = part.match(/```(\w*)\n([\s\S]*?)```/);
    if (match) {
      return <CodeBlock key={i} lang={match[1] || 'text'} code={match[2].trim()} />;
    }
    return <p key={i} style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{part}</p>;
  });
}

const SLASH_COMMANDS = [
  { name: 'clear', description: 'Clear chat history' },
  { name: 'mode', description: 'Switch mode: /mode agent|plan|ask' },
  { name: 'help', description: 'Show available commands' },
];

export function ChatPanel() {
  const locale = useSettingsStore((s) => s.locale);
  const {
    messages,
    mode,
    input,
    isStreaming,
    mentionQuery,
    setInput,
    setMode,
    addMessage,
    updateMessage,
    setStreaming,
    clear,
  } = useChatStore();
  const filePaths = useWorkspaceStore((s) => s.getAllFilePaths());

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    if (input.startsWith('/')) {
      const [cmd, ...args] = input.slice(1).split(' ');
      if (cmd === 'clear') { clear(); setInput(''); return; }
      if (cmd === 'mode' && args[0]) {
        setMode(args[0] as AgentMode);
        setInput('');
        return;
      }
      if (cmd === 'help') {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: SLASH_COMMANDS.map((c) => `/${c.name} — ${c.description}`).join('\n'),
          createdAt: Date.now(),
        });
        setInput('');
        return;
      }
    }

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: input,
      createdAt: Date.now(),
    };
    addMessage(userMsg);
    setInput('');
    setStreaming(true);

    const assistantId = crypto.randomUUID();
    addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true,
    });

    try {
      resetModelRouter();
      const router = getModelRouter();
      const client = router.getClient();
      const model = router.getModel(mode === 'agent' ? 'agent' : 'chat', input);
      const allMessages = [...messages, userMsg];

      const systemPrompt =
        mode === 'plan'
          ? 'You are in planning mode. Outline steps without executing.'
          : mode === 'ask'
            ? 'Answer questions helpfully without suggesting file changes.'
            : 'You are an AI coding assistant with agent capabilities.';

      let content = '';
      for await (const chunk of client.chatCompletionStream({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messagesToApi(allMessages),
        ],
        temperature: 0.4,
      })) {
        content += chunk.delta.content ?? '';
        updateMessage(assistantId, content, true);
      }

      updateMessage(assistantId, content, false);
      try {
        const mgr = await getSessionManager();
        const chatSession = await getOrCreateSession(mode);
        mgr.addMessage(chatSession, {
          id: assistantId,
          role: 'assistant',
          content,
          createdAt: Date.now(),
        });
        await mgr.save(chatSession);
      } catch {
        // persistence optional in browser mode
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      updateMessage(assistantId, `Error: ${msg}`, false);
    } finally {
      setStreaming(false);
    }
  };

  const mentionSuggestions = mentionQuery !== null
    ? filePaths.filter((p) => p.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8)
    : [];

  return (
    <aside className="chat-panel">
      <div className="panel-header">
        <span>{t(locale, 'chat.title')}</span>
        <div className="mode-toggle">
          {(['agent', 'plan', 'ask'] as AgentMode[]).map((m) => (
            <button
              key={m}
              className={clsx('mode-btn', mode === m && 'active')}
              onClick={() => setMode(m)}
            >
              {t(locale, `chat.modes.${m}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={clsx('chat-message', msg.role)}>
            <span className="chat-role">{msg.role}</span>
            {renderMessageContent(msg.content)}
            {msg.streaming && <span className="streaming-dot">▋</span>}
          </div>
        ))}
      </div>

      {mentionSuggestions.length > 0 && (
        <div className="mention-dropdown">
          {mentionSuggestions.map((path) => (
            <button
              key={path}
              className="mention-item"
              onClick={() => {
                const before = input.replace(/@[\w./-]*$/, '');
                setInput(`${before}@${path} `);
              }}
            >
              {path}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input-area">
        <textarea
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t(locale, 'chat.placeholder')}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button className="btn btn-primary send-btn" onClick={handleSend} disabled={isStreaming}>
          <Send size={14} />
        </button>
      </div>

      <style>{`
        .chat-panel {
          width: var(--chat-width);
          background: var(--bg-surface);
          border-left: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .mode-toggle { display: flex; gap: 2px; }
        .mode-btn {
          padding: 2px 6px;
          font-size: 10px;
          border-radius: 4px;
          color: var(--text-muted);
        }
        .mode-btn.active { background: var(--accent-muted); color: var(--accent); }
        .chat-messages {
          flex: 1;
          overflow: auto;
          padding: 12px;
        }
        .chat-message {
          margin-bottom: 12px;
          font-size: 13px;
          line-height: 1.5;
        }
        .chat-message.user .chat-role { color: var(--accent); }
        .chat-message.assistant .chat-role { color: var(--text-muted); }
        .chat-role {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .streaming-dot { animation: blink 1s step-end infinite; color: var(--accent); }
        @keyframes blink { 50% { opacity: 0; } }
        .mention-dropdown {
          border-top: 1px solid var(--border-subtle);
          max-height: 160px;
          overflow: auto;
        }
        .mention-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 6px 12px;
          font-size: 12px;
          font-family: var(--font-mono);
        }
        .mention-item:hover { background: var(--bg-hover); }
        .chat-input-area {
          display: flex;
          gap: 8px;
          padding: 8px;
          border-top: 1px solid var(--border-subtle);
        }
        .chat-input-area textarea { flex: 1; resize: none; }
        .send-btn { align-self: flex-end; }
      `}</style>
    </aside>
  );
}
