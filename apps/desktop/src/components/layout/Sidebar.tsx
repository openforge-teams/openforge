import { useState } from 'react';
import type { ActivityId } from './ActivityBar';
import { Explorer } from '@/components/explorer/Explorer';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { useSettingsStore } from '@/stores/settingsStore';
import { t } from '@/i18n';

interface SidebarProps {
  activity: ActivityId;
}

export function Sidebar({ activity }: SidebarProps) {
  const locale = useSettingsStore((s) => s.locale);
  const [searchQuery, setSearchQuery] = useState('');

  if (activity === 'explorer') return <Explorer />;
  if (activity === 'agent') return <AgentPanel />;

  return (
    <aside className="sidebar">
      <div className="panel-header">{t(locale, `activity.${activity}`)}</div>
      <div className="sidebar-content">
        {activity === 'search' && (
          <>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(locale, 'activity.search') + '...'}
              style={{ width: '100%', marginBottom: 8 }}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {searchQuery ? `Searching for "${searchQuery}"...` : 'Enter a search term'}
            </p>
          </>
        )}
        {activity === 'git' && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Git integration coming soon.</p>
        )}
      </div>
      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          background: var(--bg-surface);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .sidebar-content {
          padding: 12px;
          overflow: auto;
          flex: 1;
        }
      `}</style>
    </aside>
  );
}
