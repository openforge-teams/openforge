import { useRef, useEffect, useState } from 'react';
import { Terminal as TerminalIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useSettingsStore } from '@/stores/settingsStore';
import { t } from '@/i18n';
import { isTauri, runCommand } from '@/host/tauri';
import { getFS } from '@/host/fs';

export function TerminalPanel() {
  const locale = useSettingsStore((s) => s.locale);
  const [open, setOpen] = useState(true);
  const [tauriMode, setTauriMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const inputBuffer = useRef('');

  useEffect(() => {
    isTauri().then(setTauriMode);
  }, []);

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener('toggle-terminal', toggle);
    return () => window.removeEventListener('toggle-terminal', toggle);
  }, []);

  useEffect(() => {
    if (!open || !containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#18181b',
        foreground: '#fafafa',
        cursor: '#14b8a6',
        selectionBackground: 'rgba(20, 184, 166, 0.3)',
      },
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      cursorBlink: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    term.writeln('\x1b[1;36mOpenForge Terminal\x1b[0m');
    if (!tauriMode) {
      term.writeln(`\x1b[90m${t(locale, 'terminal.webNote')}\x1b[0m`);
    }
    term.write('\r\n$ ');

    term.onData(async (data) => {
      if (data === '\r') {
        const cmd = inputBuffer.current.trim();
        term.write('\r\n');
        inputBuffer.current = '';

        if (cmd) {
          if (tauriMode) {
            try {
              const fs = await getFS();
              const cwd = fs.getProjectRoot() ?? '/workspace';
              const output = await runCommand(cwd, cmd);
              term.writeln(output);
            } catch (err) {
              term.writeln(`\x1b[31m${err instanceof Error ? err.message : 'Error'}\x1b[0m`);
            }
          } else {
            term.writeln(`\x1b[90m[simulated] ${cmd}\x1b[0m`);
            if (cmd === 'help') {
              term.writeln('  help, clear, echo <text>');
            } else if (cmd === 'clear') {
              term.clear();
            } else if (cmd.startsWith('echo ')) {
              term.writeln(cmd.slice(5));
            } else {
              term.writeln(`\x1b[33mCommand not found: ${cmd}\x1b[0m`);
            }
          }
        }
        term.write('$ ');
      } else if (data === '\u007F') {
        if (inputBuffer.current.length > 0) {
          inputBuffer.current = inputBuffer.current.slice(0, -1);
          term.write('\b \b');
        }
      } else {
        inputBuffer.current += data;
        term.write(data);
      }
    });

    termRef.current = term;
    fitRef.current = fit;

    const resizeObserver = new ResizeObserver(() => fit.fit());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [open, locale, tauriMode]);

  return (
    <div className={`terminal-panel ${open ? 'open' : 'collapsed'}`}>
      <div className="panel-header" onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TerminalIcon size={14} />
          {t(locale, 'terminal.title')}
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </div>
      {open && <div ref={containerRef} className="terminal-container" />}
      <style>{`
        .terminal-panel {
          background: var(--bg-surface);
          border-top: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
        }
        .terminal-panel.collapsed .terminal-container { display: none; }
        .terminal-panel.open { height: 220px; }
        .terminal-panel.collapsed { height: var(--panel-header); }
        .terminal-container { flex: 1; padding: 4px; overflow: hidden; }
      `}</style>
    </div>
  );
}
