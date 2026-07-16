import { useEffect } from 'react';

interface ShortcutHandlers {
  onChat: () => void;
  onInlineEdit: () => void;
  onAgent: () => void;
  onTerminal: () => void;
  onPalette: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === 'l') {
        e.preventDefault();
        handlers.onChat();
      } else if (mod && e.key === 'k') {
        e.preventDefault();
        handlers.onInlineEdit();
      } else if (mod && e.key === 'i') {
        e.preventDefault();
        handlers.onAgent();
        window.dispatchEvent(new CustomEvent('focus-agent'));
      } else if (mod && e.key === '`') {
        e.preventDefault();
        handlers.onTerminal();
      } else if (mod && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        handlers.onPalette();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
