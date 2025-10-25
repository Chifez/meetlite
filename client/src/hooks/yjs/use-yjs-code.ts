import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { documentManager } from '@/lib/yjs/yjs-document-manager';
import { awarenessManager } from '@/lib/yjs/yjs-awareness-manager';
import { indexToLineColumn } from '@/lib/yjs/cursor-utils';

/**
 * Hook for collaborative code editing with Yjs
 * Pure YJS implementation - no legacy callback system
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

    // Only log in development to reduce console noise
    if (process.env.NODE_ENV === 'development') {
      console.log('[useYjsCode] Initializing for room:', roomId);
    }

    // Get Y.Text for code editor
    const text = documentManager.getCodeText(roomId);
    const docId = `code-${roomId}`;
    docIdRef.current = docId;

    setYText(text);
    setIsReady(true);

    // Cleanup
    return () => {
      // Don't destroy here - let the provider/document manager handle it
      setYText(null);
      setIsReady(false);
    };
  }, [roomId, enabled]);

  // Update cursor position in awareness
  const updateCursor = useCallback(
    (index: number, text?: string) => {
      if (!docIdRef.current || !yText) return;

      const textContent = text ?? yText.toString();
      const { line, column } = indexToLineColumn(textContent, index);

      awarenessManager.updateCursor(docIdRef.current, {
        index,
        line,
        column,
        timestamp: Date.now(),
      });
    },
    [yText]
  );

  // Update selection in awareness
  const updateSelection = useCallback(
    (startIndex: number, endIndex: number, text?: string) => {
      if (!docIdRef.current || !yText) return;

      const textContent = text ?? yText.toString();
      const startPos = indexToLineColumn(textContent, startIndex);
      const endPos = indexToLineColumn(textContent, endIndex);

      awarenessManager.updateSelection(docIdRef.current, {
        start: {
          index: startIndex,
          line: startPos.line,
          column: startPos.column,
          timestamp: Date.now(),
        },
        end: {
          index: endIndex,
          line: endPos.line,
          column: endPos.column,
          timestamp: Date.now(),
        },
      });
    },
    [yText]
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
