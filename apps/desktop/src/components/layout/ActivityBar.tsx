import { useEffect } from 'react';
import {
  Files,
  Search,
  GitBranch,
  Bot,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';
import { useSettingsStore } from '@/stores/settingsStore';
import { t } from '@/i18n';

export type ActivityId = 'explorer' | 'search' | 'git' | 'agent' | 'settings';

interface ActivityBarProps {
  active: ActivityId;
  onChange: (id: ActivityId) => void;
  onOpenSettings: () => void;
}

const items: Array<{ id: ActivityId; icon: typeof Files; labelKey: string }> = [
  { id: 'explorer', icon: Files, labelKey: 'activity.explorer' },
  { id: 'search', icon: Search, labelKey: 'activity.search' },
  { id: 'git', icon: GitBranch, labelKey: 'activity.git' },
  { id: 'agent', icon: Bot, labelKey: 'activity.agent' },
];

export function ActivityBar({ active, onChange, onOpenSettings }: ActivityBarProps) {
  const locale = useSettingsStore((s) => s.locale);

  useEffect(() => {
    const handler = () => onChange('agent');
    window.addEventListener('focus-agent', handler);
    return () => window.removeEventListener('focus-agent', handler);
  }, [onChange]);

  return (
    <nav className="activity-bar">
      {items.map(({ id, icon: Icon, labelKey }) => (
        <button
          key={id}
          className={clsx('icon-btn', active === id && 'active')}
          title={t(locale, labelKey)}
          onClick={() => onChange(id)}
        >
          <Icon size={20} />
        </button>
      ))}
      <div className="activity-spacer" />
      <button
        className="icon-btn"
        title={t(locale, 'activity.settings')}
        onClick={onOpenSettings}
      >
        <Settings size={20} />
      </button>
      <style>{`
        .activity-bar {
          width: var(--activity-width);
          background: var(--bg-surface);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 0;
          gap: 4px;
        }
        .activity-spacer { flex: 1; }
      `}</style>
    </nav>
  );
}
