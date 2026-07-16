import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useEditorStore } from '@/stores/editorStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

const COMMANDS = [
  { id: 'open-folder', labelKey: 'explorer.openFolder' },
  { id: 'toggle-terminal', labelKey: 'shortcuts.terminal' },
  { id: 'focus-chat', labelKey: 'shortcuts.chat' },
  { id: 'inline-edit', labelKey: 'shortcuts.inlineEdit' },
  { id: 'agent-panel', labelKey: 'shortcuts.agent' },
];

export function CommandPalette({ open, onClose }: Props) {
  const locale = useSettingsStore((s) => s.locale);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
    }
  }, [open]);

  const filtered = COMMANDS.filter((c) =>
    t(locale, c.labelKey).toLowerCase().includes(query.toLowerCase()),
  );

  const execute = (id: string) => {
    onClose();
    switch (id) {
      case 'open-folder':
        useWorkspaceStore.getState().openFolder();
        break;
      case 'toggle-terminal':
        window.dispatchEvent(new CustomEvent('toggle-terminal'));
        break;
      case 'focus-chat':
        document.getElementById('chat-input')?.focus();
        break;
      case 'inline-edit':
        useEditorStore.getState().setInlineEditOpen(true);
        break;
      case 'agent-panel':
        window.dispatchEvent(new CustomEvent('focus-agent'));
        break;
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
          placeholder={t(locale, 'palette.placeholder')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            } else if (e.key === 'Enter' && filtered[selected]) {
              execute(filtered[selected].id);
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
        />
        <ul className="palette-list">
          {filtered.map((cmd, i) => (
            <li
              key={cmd.id}
              className={i === selected ? 'selected' : ''}
              onClick={() => execute(cmd.id)}
            >
              {t(locale, cmd.labelKey)}
            </li>
          ))}
        </ul>
        <style>{`
          .palette {
            width: 480px;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 8px;
            box-shadow: var(--shadow);
            overflow: hidden;
          }
          .palette input {
            width: 100%;
            border: none;
            border-bottom: 1px solid var(--border-subtle);
            border-radius: 0;
            padding: 12px 16px;
            font-size: 14px;
          }
          .palette-list { list-style: none; max-height: 300px; overflow: auto; }
          .palette-list li {
            padding: 8px 16px;
            font-size: 13px;
            cursor: pointer;
          }
          .palette-list li:hover, .palette-list li.selected {
            background: var(--accent-muted);
            color: var(--accent);
          }
        `}</style>
      </div>
    </div>
  );
}
