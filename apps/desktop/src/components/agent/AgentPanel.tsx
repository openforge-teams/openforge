import { Square, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useAgentStore } from '@/stores/agentStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { t } from '@/i18n';
import { createAgentEngine, getAgentEngine } from '@/adapters/core';
import { getFS } from '@/host/fs';

function StepIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle2 size={14} className="step-done" />;
  if (status === 'error') return <AlertCircle size={14} className="step-error" />;
  if (status === 'active') return <Circle size={14} className="step-active" />;
  return <Circle size={14} />;
}

export function AgentPanel() {
  const locale = useSettingsStore((s) => s.locale);
  const { running, steps, progress, setRunning, addStep, addEvent, reset } = useAgentStore();
  const { queue, current, resolve } = useApprovalStore();

  const handleInterrupt = () => {
    getAgentEngine()?.interrupt();
    setRunning(false);
  };

  const handleRunDemo = async () => {
    const fs = await getFS();
    const root = fs.getProjectRoot() ?? '/workspace';
    reset();
    setRunning(true);

    const engine = createAgentEngine(root, 'agent');

    try {
      for await (const event of engine.run('Analyze the workspace and suggest improvements.')) {
        addEvent(event);
        if (event.type === 'step' && event.step) {
          addStep(event.step);
        }
        if (event.type === 'error' || event.type === 'done') {
          break;
        }
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <aside className="agent-panel" id="agent-panel">
      <div className="panel-header">
        <span>{t(locale, 'agent.title')}</span>
        {running && (
          <button className="btn btn-ghost" onClick={handleInterrupt} style={{ padding: '2px 8px', fontSize: 10 }}>
            <Square size={10} />
            {t(locale, 'agent.interrupt')}
          </button>
        )}
      </div>

      <div className="agent-content">
        <div className="agent-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-label">
            {running ? t(locale, 'agent.running') : progress >= 100 ? t(locale, 'agent.completed') : t(locale, 'agent.idle')}
          </span>
        </div>

        {!running && steps.length === 0 && (
          <button className="btn btn-primary" onClick={handleRunDemo} style={{ width: '100%', marginBottom: 12 }}>
            Run Agent Demo
          </button>
        )}

        <h4 className="section-title">{t(locale, 'agent.steps')}</h4>
        {steps.length === 0 ? (
          <p className="empty-text">{t(locale, 'agent.noSteps')}</p>
        ) : (
          <ul className="step-list">
            {steps.map((step) => (
              <li key={step.id} className={clsx('step-item', step.status)}>
                <StepIcon status={step.status} />
                <span>{step.label}</span>
              </li>
            ))}
          </ul>
        )}

        <h4 className="section-title">{t(locale, 'approval.queue')}</h4>
        {queue.length === 0 ? (
          <p className="empty-text">{t(locale, 'approval.empty')}</p>
        ) : (
          <ul className="approval-list">
            {queue.map((req) => (
              <li key={req.id} className="approval-item">
                <span className="badge">{req.risk}</span>
                <span>{req.toolName}</span>
                {current?.id === req.id && (
                  <div className="approval-actions">
                    <button className="btn btn-primary" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => resolve(req.id, 'once')}>
                      {t(locale, 'approval.once')}
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => resolve(req.id, 'always')}>
                      {t(locale, 'approval.always')}
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => resolve(req.id, 'deny')}>
                      {t(locale, 'approval.deny')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .agent-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-panel);
        }
        .agent-content { flex: 1; overflow: auto; padding: 12px; }
        .agent-progress { margin-bottom: 16px; }
        .progress-bar {
          height: 4px;
          background: var(--bg-elevated);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 6px;
        }
        .progress-fill {
          height: 100%;
          background: var(--accent);
          transition: width 0.2s ease;
        }
        .progress-label { font-size: 11px; color: var(--text-muted); }
        .section-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted);
          margin: 12px 0 8px;
        }
        .empty-text { font-size: 12px; color: var(--text-muted); }
        .step-list, .approval-list { list-style: none; padding: 0; margin: 0; }
        .step-item, .approval-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          font-size: 12px;
        }
        .step-done { color: var(--success, #3dd68c); }
        .step-error { color: var(--danger, #f07178); }
        .step-active { color: var(--accent); }
        .badge {
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 4px;
          background: var(--bg-elevated);
          text-transform: uppercase;
        }
        .approval-actions { margin-left: auto; display: flex; gap: 4px; }
      `}</style>
    </aside>
  );
}
