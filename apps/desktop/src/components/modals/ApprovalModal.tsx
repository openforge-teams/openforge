import { useApprovalStore } from '@/stores/approvalStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { t } from '@/i18n';

export function ApprovalModal() {
  const locale = useSettingsStore((s) => s.locale);
  const { current, resolve } = useApprovalStore();

  if (!current) return null;

  return (
    <div className="modal-overlay">
      <div className="modal approval-modal">
        <div className="modal-header">
          <span>{t(locale, 'approval.title')}</span>
          <span className="badge">{current.risk}</span>
        </div>
        <div className="modal-body">
          <p><strong>{current.toolName}</strong></p>
          {current.reason && <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{current.reason}</p>}
          <pre className="approval-args">
            {JSON.stringify(current.arguments, null, 2)}
          </pre>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => resolve(current.id, 'deny')}>
            {t(locale, 'approval.deny')}
          </button>
          <button className="btn btn-ghost" onClick={() => resolve(current.id, 'always')}>
            {t(locale, 'approval.always')}
          </button>
          <button className="btn btn-primary" onClick={() => resolve(current.id, 'once')}>
            {t(locale, 'approval.once')}
          </button>
        </div>
        <style>{`
          .approval-modal { width: 440px; }
          .approval-args {
            margin-top: 12px;
            padding: 8px;
            background: var(--bg-base);
            border-radius: var(--radius);
            font-family: var(--font-mono);
            font-size: 11px;
            overflow: auto;
            max-height: 200px;
          }
        `}</style>
      </div>
    </div>
  );
}
