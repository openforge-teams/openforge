import { useSettingsStore } from '@/stores/settingsStore';
import { useEditorStore } from '@/stores/editorStore';
import { t } from '@/i18n';

export function StatusBar() {
  const theme = useSettingsStore((s) => s.theme);
  const settingsLocale = useSettingsStore((s) => s.locale);
  const tab = useEditorStore((s) => s.getActiveTab());

  return (
    <footer className="status-bar">
      <span>{t(settingsLocale, 'status.ready')}</span>
      <span className="status-right">
        {tab && (
          <>
            <span>
              {t(settingsLocale, 'status.line')} {tab.cursorLine}, {t(settingsLocale, 'status.col')}{' '}
              {tab.cursorColumn}
            </span>
            <span>{tab.language}</span>
          </>
        )}
        <span>{theme}</span>
      </span>
      <style>{`
        .status-bar {
          height: var(--status-height);
          background: var(--accent);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          font-size: 11px;
        }
        .status-right {
          display: flex;
          gap: 16px;
        }
      `}</style>
    </footer>
  );
}
