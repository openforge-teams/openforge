import { useRef, useCallback, useEffect } from 'react';
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useEditorStore } from '@/stores/editorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGhostCompletion } from '@/hooks/useGhostCompletion';
import { InlineEditOverlay } from './InlineEditOverlay';

export function MonacoEditorPanel() {
  const theme = useSettingsStore((s) => s.theme);
  const { tabs, activeTabId, updateContent, setCursor, ghostText } = useEditorStore();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationIds = useRef<string[]>([]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const { triggerCompletion, dismissCompletion, acceptCompletion } = useGhostCompletion(editorRef);

  const updateGhostDecoration = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !ghostText) {
      if (editor) {
        decorationIds.current = editor.deltaDecorations(decorationIds.current, []);
      }
      return;
    }

    const position = editor.getPosition();
    if (!position) return;

    decorationIds.current = editor.deltaDecorations(decorationIds.current, [
      {
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        options: {
          after: { content: ghostText, inlineClassName: 'ghost-decoration' },
        },
      },
    ]);
  }, [ghostText]);

  useEffect(() => {
    updateGhostDecoration();
  }, [ghostText, updateGhostDecoration]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      triggerCompletion();
    });

    editor.addCommand(monaco.KeyCode.Tab, () => {
      if (ghostText) {
        acceptCompletion();
      } else {
        editor.trigger('keyboard', 'type', { text: '\t' });
      }
    });

    editor.addCommand(monaco.KeyCode.Escape, () => {
      dismissCompletion();
      useEditorStore.getState().setInlineEditOpen(false);
    });

    editor.onDidChangeCursorPosition((e) => {
      if (activeTabId) {
        setCursor(activeTabId, e.position.lineNumber, e.position.column);
      }
      triggerCompletion();
    });

    editor.onDidChangeModelContent(() => {
      dismissCompletion();
    });
  };

  if (!activeTab) {
    return (
      <div className="editor-empty">
        <p>Open a file from the explorer to start editing.</p>
        <style>{`
          .editor-empty {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            background: var(--bg-base);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <Editor
        key={activeTab.id}
        height="100%"
        language={activeTab.language}
        value={activeTab.content}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        onChange={(value) => updateContent(activeTab.id, value ?? '')}
        onMount={handleMount}
        options={{
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          padding: { top: 8 },
        }}
      />
      <InlineEditOverlay editorRef={editorRef} />
      <style>{`
        .editor-container {
          flex: 1;
          position: relative;
          overflow: hidden;
          background: var(--bg-base);
        }
      `}</style>
    </div>
  );
}
