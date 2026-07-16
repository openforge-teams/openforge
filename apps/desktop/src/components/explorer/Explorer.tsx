import { FolderOpen, File, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useWorkspaceStore, type TreeNode } from '@/stores/workspaceStore';
import { useEditorStore } from '@/stores/editorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getFS } from '@/host/fs';
import { t } from '@/i18n';

function FileTreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const toggleExpand = useWorkspaceStore((s) => s.toggleExpand);
  const openTab = useEditorStore((s) => s.openTab);
  const { entry, expanded, children } = node;

  const handleClick = async () => {
    if (entry.isDirectory) {
      toggleExpand(entry.path);
    } else {
      const fs = await getFS();
      const content = await fs.readFile(entry.path);
      openTab({
        id: entry.path,
        path: entry.path,
        name: entry.name,
        content,
        language: '',
      });
    }
  };

  return (
    <>
      <button
        className="tree-item"
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={handleClick}
      >
        {entry.isDirectory ? (
          expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        ) : (
          <span style={{ width: 14 }} />
        )}
        {entry.isDirectory ? <FolderOpen size={14} /> : <File size={14} />}
        <span className="tree-name">{entry.name}</span>
      </button>
      {expanded && children?.map((child) => (
        <FileTreeItem key={child.entry.path} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function Explorer() {
  const locale = useSettingsStore((s) => s.locale);
  const { root, tree, loading, openFolder, refreshTree } = useWorkspaceStore();

  return (
    <aside className="explorer">
      <div className="panel-header">
        <span>{t(locale, 'activity.explorer')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" onClick={refreshTree} title="Refresh">
            <RefreshCw size={14} className={clsx(loading && 'spin')} />
          </button>
        </div>
      </div>
      <div className="explorer-actions">
        <button className="btn btn-ghost" onClick={openFolder} style={{ width: '100%' }}>
          <FolderOpen size={14} />
          {t(locale, 'explorer.openFolder')}
        </button>
      </div>
      <div className="explorer-tree">
        {!root && (
          <p className="explorer-empty">{t(locale, 'explorer.noFolder')}</p>
        )}
        {root && tree.length === 0 && (
          <p className="explorer-empty">{t(locale, 'explorer.empty')}</p>
        )}
        {tree.map((node) => (
          <FileTreeItem key={node.entry.path} node={node} depth={0} />
        ))}
      </div>
      <style>{`
        .explorer {
          width: var(--sidebar-width);
          background: var(--bg-surface);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .explorer-actions { padding: 8px; }
        .explorer-tree { flex: 1; overflow: auto; }
        .explorer-empty {
          padding: 12px;
          color: var(--text-muted);
          font-size: 12px;
        }
        .tree-item {
          display: flex;
          align-items: center;
          gap: 4px;
          width: 100%;
          padding: 4px 8px;
          font-size: 12px;
          color: var(--text-secondary);
          text-align: left;
        }
        .tree-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .tree-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </aside>
  );
}
