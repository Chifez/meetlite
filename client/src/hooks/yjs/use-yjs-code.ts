import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { documentManager } from '@/lib/yjs/yjs-document-manager';
import { awarenessManager } from '@/lib/yjs/yjs-awareness-manager';
import { indexToLineColumn } from '@/lib/yjs/cursor-utils';

// Throttle interval for cursor updates (60ms = ~16fps, smooth but efficient)
const CURSOR_THROTTLE_MS = 60;

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
  
  // Throttling refs for cursor updates
  const lastCursorUpdate = useRef<number>(0);
  const pendingCursorUpdate = useRef<{ index: number; text?: string } | null>(null);
  const throttleTimeout = useRef<NodeJS.Timeout | null>(null);

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
      
      // Clear any pending throttle timeout
      if (throttleTimeout.current) {
        clearTimeout(throttleTimeout.current);
        throttleTimeout.current = null;
      }
    };
  }, [roomId, enabled]);

  // Throttled cursor update function - updates at most every 60ms
  const updateCursor = useCallback(
    (index: number, text?: string) => {
      if (!docIdRef.current || !yText) return;

      const now = Date.now();
      const timeSinceLastUpdate = now - lastCursorUpdate.current;

      // Store pending update
      pendingCursorUpdate.current = { index, text };

      // Helper to send the cursor update
      const sendCursorUpdate = () => {
        if (!pendingCursorUpdate.current || !docIdRef.current || !yText) return;

        const { index: cursorIndex, text: cursorText } = pendingCursorUpdate.current;
        const textContent = cursorText ?? yText.toString();
        const { line, column } = indexToLineColumn(textContent, cursorIndex);

        awarenessManager.updateCursor(docIdRef.current, {
          index: cursorIndex,
          line,
          column,
          timestamp: Date.now(),
        });

        pendingCursorUpdate.current = null;
        lastCursorUpdate.current = Date.now();
      };

      // If enough time has passed, send immediately
      if (timeSinceLastUpdate >= CURSOR_THROTTLE_MS) {
        sendCursorUpdate();
      } else if (!throttleTimeout.current) {
        // Schedule a delayed update
        throttleTimeout.current = setTimeout(() => {
          throttleTimeout.current = null;
          sendCursorUpdate();
        }, CURSOR_THROTTLE_MS - timeSinceLastUpdate);
      }
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
