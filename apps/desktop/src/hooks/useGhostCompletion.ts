import { useRef, useEffect, useCallback } from 'react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useEditorStore } from '@/stores/editorStore';
import { getModelRouter, resetModelRouter } from '@/adapters/core';

const DEBOUNCE_MS = 400;

export function useGhostCompletion(
  editorRef: React.RefObject<MonacoEditor.IStandaloneCodeEditor | null>,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const { setGhostText, ghostText, getActiveTab } = useEditorStore();

  const dismissCompletion = useCallback(() => {
    clearTimeout(timerRef.current);
    setGhostText(null);
  }, [setGhostText]);

  const acceptCompletion = useCallback(() => {
    const editor = editorRef.current;
    const text = useEditorStore.getState().ghostText;
    if (!editor || !text) return;

    const position = editor.getPosition();
    if (!position) return;

    editor.executeEdits('ghost', [
      {
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
        text,
      },
    ]);
    setGhostText(null);
  }, [editorRef, setGhostText]);

  const triggerCompletion = useCallback(() => {
    clearTimeout(timerRef.current);
    const tab = getActiveTab();
    const editor = editorRef.current;
    if (!tab || !editor) return;

    timerRef.current = setTimeout(async () => {
      const model = editor.getModel();
      const position = editor.getPosition();
      if (!model || !position) return;

      const offset = model.getOffsetAt(position);
      const fullText = model.getValue();
      const prefix = fullText.slice(0, offset);
      const suffix = fullText.slice(offset);

      try {
        resetModelRouter();
        const router = getModelRouter();
        const result = await router.fimComplete(prefix, suffix);
        if (result.trim()) {
          setGhostText(result);
        }
      } catch {
        setGhostText(null);
      }
    }, DEBOUNCE_MS);
  }, [editorRef, getActiveTab, setGhostText]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { triggerCompletion, dismissCompletion, acceptCompletion, ghostText };
}
