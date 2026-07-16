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
  // Start collapsed so first paint is stable; user can expand the panel
  const [open, setOpen] = useState(false);
  const [tauriMode, setTauriMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const inputBuffer = useRef('');
  const tauriModeRef = useRef(false);
  const localeRef = useRef(locale);

  useEffect(() => {
    isTauri().then((v) => {
      tauriModeRef.current = v;
      setTauriMode(v);
    });
  }, []);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener('toggle-terminal', toggle);
    return () => window.removeEventListener('toggle-terminal', toggle);
  }, []);

  useEffect(() => {
    if (!open || !containerRef.current) return;

    let disposed = false;
    const el = containerRef.current;

    const term = new Terminal({
      theme: {
        background: '#18181b',
        foreground: '#fafafa',
        cursor: '#14b8a6',
        selectionBackground: 'rgba(20, 184, 166, 0.3)',
      },
      fontFamily: 'JetBrains Mono, Fira Code, Cascadia Code, Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(el);

    const safeFit = () => {
      if (disposed || !el.isConnected || el.clientWidth < 8 || el.clientHeight < 8) return;
      try {
        fit.fit();
      } catch {
        // FitAddon may throw during StrictMode remount / dispose races
      }
    };

    requestAnimationFrame(safeFit);

    term.writeln('\x1b[1;36mOpenForge Terminal\x1b[0m');
    if (!tauriModeRef.current) {
      term.writeln(`\x1b[90m${t(localeRef.current, 'terminal.webNote')}\x1b[0m`);
    }
    term.write('\r\n$ ');

    term.onData(async (data) => {
      if (disposed) return;
      if (data === '\r') {
        const cmd = inputBuffer.current.trim();
        term.write('\r\n');
        inputBuffer.current = '';

        if (cmd) {
          if (tauriModeRef.current) {
            try {
              const fs = await getFS();
              const cwd = fs.getProjectRoot() ?? '/workspace';
              const output = await runCommand(cwd, cmd);
              if (!disposed) term.writeln(output);
            } catch (err) {
              if (!disposed) {
                term.writeln(`\x1b[31m${err instanceof Error ? err.message : 'Error'}\x1b[0m`);
              }
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
      } else if (data.length === 1 && data >= ' ') {
        inputBuffer.current += data;
        term.write(data);
      }
    });

    termRef.current = term;
    fitRef.current = fit;

    const resizeObserver = new ResizeObserver(() => safeFit());
    resizeObserver.observe(el);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      termRef.current = null;
      fitRef.current = null;
      // Defer dispose so in-flight xterm Viewport RAF won't hit a disposed core
      // (React StrictMode remount race).
      const toDispose = term;
      setTimeout(() => {
        try {
          toDispose.dispose();
        } catch {
          // ignore
        }
      }, 0);
    };
  }, [open]);

  return (
    <div className={`terminal-panel ${open ? 'open' : 'collapsed'}`}>
      <div className="panel-header" onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TerminalIcon size={14} />
          {t(locale, 'terminal.title')}
          {tauriMode ? '' : ''}
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
        .terminal-container { flex: 1; padding: 4px; overflow: hidden; min-height: 0; }
      `}</style>
    </div>
  );
}
