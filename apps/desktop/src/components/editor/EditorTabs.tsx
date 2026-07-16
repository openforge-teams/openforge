import { X } from 'lucide-react';
import clsx from 'clsx';
import { useEditorStore } from '@/stores/editorStore';

export function EditorTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditorStore();

  if (tabs.length === 0) return null;

  return (
    <div className="editor-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={clsx('tab', activeTabId === tab.id && 'active')}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-name">
            {tab.name}
            {tab.dirty && <span className="dirty">●</span>}
          </span>
          <span
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          >
            <X size={12} />
          </span>
        </button>
      ))}
      <style>{`
        .editor-tabs {
          display: flex;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
          overflow-x: auto;
          min-height: 35px;
        }
        .tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 12px;
          height: 35px;
          font-size: 12px;
          color: var(--text-secondary);
          border-right: 1px solid var(--border-subtle);
          white-space: nowrap;
        }
        .tab:hover { background: var(--bg-hover); }
        .tab.active {
          background: var(--bg-base);
          color: var(--text-primary);
          border-top: 2px solid var(--accent);
        }
        .dirty { color: var(--accent); margin-left: 4px; font-size: 8px; }
        .tab-close {
          display: flex;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .tab:hover .tab-close, .tab.active .tab-close { opacity: 1; }
        .tab-close:hover { color: var(--text-primary); }
      `}</style>
    </div>
  );
}
