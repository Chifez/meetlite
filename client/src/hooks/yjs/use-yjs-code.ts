import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { documentManager } from '@/lib/yjs/yjs-document-manager';
import { awarenessManager } from '@/lib/yjs/yjs-awareness-manager';

/**
 * Hook for collaborative code editing with Yjs
 */
export function useYjsCode(
  roomId: string | undefined,
  enabled: boolean = true
) {
  const [yText, setYText] = useState<Y.Text | null>(null);
  const [isReady, setIsReady] = useState(false);
  const docIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!roomId || !enabled) {
      setYText(null);
      setIsReady(false);
      return;
    }

    console.log('[useYjsCode] Initializing for room:', roomId);

    // Get Y.Text for code editor
    const text = documentManager.getCodeText(roomId);
    const docId = `code-${roomId}`;
    docIdRef.current = docId;

    setYText(text);
    setIsReady(true);

    console.log('[useYjsCode] Y.Text ready');

    // Cleanup
    return () => {
      console.log('[useYjsCode] Cleanup');
      // Don't destroy here - let the provider/document manager handle it
      setYText(null);
      setIsReady(false);
    };
  }, [roomId, enabled]);

  // Update cursor position in awareness
  const updateCursor = useCallback(
    (line: number, column: number, index: number) => {
      if (!docIdRef.current) return;

      awarenessManager.updateCursor(docIdRef.current, {
        line,
        column,
        index,
      });
    },
    []
  );

  // Update selection in awareness
  const updateSelection = useCallback(
    (
      startLine: number,
      startColumn: number,
      startIndex: number,
      endLine: number,
      endColumn: number,
      endIndex: number
    ) => {
      if (!docIdRef.current) return;

      awarenessManager.updateSelection(docIdRef.current, {
        start: { line: startLine, column: startColumn, index: startIndex },
        end: { line: endLine, column: endColumn, index: endIndex },
      });
    },
    []
  );

  // Set active status
  const setActive = useCallback((isActive: boolean) => {
    if (!docIdRef.current) return;

    awarenessManager.setActive(docIdRef.current, isActive);
  }, []);

  return {
    yText,
    isReady,
    docId: docIdRef.current,
    updateCursor,
    updateSelection,
    setActive,
  };
}
