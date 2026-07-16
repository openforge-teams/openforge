import { useState, useEffect } from 'react';
import type { ProviderId } from '@openforge/core/browser';
import { X } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { resetModelRouter } from '@/adapters/core';
import { t } from '@/i18n';
import type { Locale } from '@/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PROVIDERS: ProviderId[] = ['openai', 'ollama', 'volcengine', 'custom'];

export function SettingsModal({ open, onClose }: Props) {
  const store = useSettingsStore();
  const [draft, setDraft] = useState(store);

  useEffect(() => {
    if (open) {
      setDraft(useSettingsStore.getState());
    }
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    useSettingsStore.setState({
      defaultProvider: draft.defaultProvider,
      providers: draft.providers,
      theme: draft.theme,
      locale: draft.locale,
    });
    resetModelRouter();
    document.documentElement.setAttribute('data-theme', draft.theme);
    onClose();
  };

  const providerLabel = (id: ProviderId) => {
    const keys: Record<ProviderId, string> = {
      openai: 'settings.openai',
      ollama: 'settings.ollama',
      volcengine: 'settings.volcengine',
      custom: 'Custom',
    };
    return id === 'custom' ? 'Custom' : t(draft.locale, keys[id]);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>{t(draft.locale, 'settings.title')}</span>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <section className="settings-section">
            <label>{t(draft.locale, 'settings.theme')}</label>
            <select
              value={draft.theme}
              onChange={(e) => setDraft({ ...draft, theme: e.target.value as 'light' | 'dark' })}
            >
              <option value="dark">{t(draft.locale, 'settings.themeDark')}</option>
              <option value="light">{t(draft.locale, 'settings.themeLight')}</option>
            </select>
          </section>

          <section className="settings-section">
            <label>{t(draft.locale, 'settings.locale')}</label>
            <select
              value={draft.locale}
              onChange={(e) => setDraft({ ...draft, locale: e.target.value as Locale })}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </section>

          <section className="settings-section">
            <label>Default Provider</label>
            <select
              value={draft.defaultProvider}
              onChange={(e) => setDraft({ ...draft, defaultProvider: e.target.value as ProviderId })}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>{providerLabel(p)}</option>
              ))}
            </select>
          </section>

          <h3 className="settings-heading">{t(draft.locale, 'settings.providers')}</h3>
          {PROVIDERS.map((id) => (
            <div key={id} className="provider-block">
              <h4>{providerLabel(id)}</h4>
              <div className="field">
                <label>{t(draft.locale, 'settings.apiKey')}</label>
                <input
                  type="password"
                  value={draft.providers[id].apiKey}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      providers: {
                        ...draft.providers,
                        [id]: { ...draft.providers[id], apiKey: e.target.value },
                      },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>{t(draft.locale, 'settings.baseUrl')}</label>
                <input
                  value={draft.providers[id].baseURL}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      providers: {
                        ...draft.providers,
                        [id]: { ...draft.providers[id], baseURL: e.target.value },
                      },
                    })
                  }
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>{t(draft.locale, 'settings.chatModel')}</label>
                  <input
                    value={draft.providers[id].models.chat}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        providers: {
                          ...draft.providers,
                          [id]: {
                            ...draft.providers[id],
                            models: { ...draft.providers[id].models, chat: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>{t(draft.locale, 'settings.completionModel')}</label>
                  <input
                    value={draft.providers[id].models.completion}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        providers: {
                          ...draft.providers,
                          [id]: {
                            ...draft.providers[id],
                            models: { ...draft.providers[id].models, completion: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>{t(draft.locale, 'settings.agentModel')}</label>
                  <input
                    value={draft.providers[id].models.agent}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        providers: {
                          ...draft.providers,
                          [id]: {
                            ...draft.providers[id],
                            models: { ...draft.providers[id].models, agent: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t(draft.locale, 'settings.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave}>{t(draft.locale, 'settings.save')}</button>
        </div>
        <style>{`
          .settings-modal { width: 560px; max-height: 80vh; }
          .settings-section { margin-bottom: 16px; }
          .settings-section label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
          .settings-section select { width: 100%; }
          .settings-heading { font-size: 13px; margin: 16px 0 12px; color: var(--text-primary); }
          .provider-block {
            padding: 12px;
            background: var(--bg-elevated);
            border-radius: var(--radius);
            margin-bottom: 12px;
          }
          .provider-block h4 { font-size: 12px; margin-bottom: 8px; color: var(--accent); }
          .field { margin-bottom: 8px; }
          .field label { display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 2px; }
          .field input { width: 100%; }
          .field-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        `}</style>
      </div>
    </div>
  );
}
