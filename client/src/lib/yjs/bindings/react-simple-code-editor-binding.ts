import * as Y from 'yjs';
import React from 'react';
import {
  applyStringDiff,
  calculateCursorAdjustment,
} from './text-delta-converter';
import { indexToLineColumn, throttle } from '../cursor-utils';

/**
 * React Simple Code Editor Yjs Binding
 * Synchronizes Y.Text with react-simple-code-editor component
 */

export interface EditorBinding {
  yText: Y.Text;
  onLocalChange: (value: string) => void;
  getValue: () => string;
  getTextarea: () => HTMLTextAreaElement | null;
  onCursorChange?: (line: number, column: number, index: number) => void;
  destroy: () => void;
}

export function createEditorBinding(
  yText: Y.Text,
  getValue: () => string,
  onLocalChange: (value: string) => void,
  getTextarea: () => HTMLTextAreaElement | null,
  readOnly: boolean = false,
  onCursorChange?: (line: number, column: number, index: number) => void
): EditorBinding {
  let isUpdating = false;

  // Throttled cursor update to avoid spamming awareness updates
  const throttledCursorUpdate = onCursorChange
    ? throttle((line: number, column: number, index: number) => {
        onCursorChange(line, column, index);
      }, 100)
    : null;

  // Track cursor position changes
  const handleCursorChange = () => {
    if (!onCursorChange || !throttledCursorUpdate) return;

    const textarea = getTextarea();
    if (!textarea) return;

    const index = textarea.selectionStart;
    const text = yText.toString();
    const { line, column } = indexToLineColumn(text, index);

    console.log('[EditorBinding] Cursor changed:', { line, column, index });
    throttledCursorUpdate(line, column, index);
  };

  // Attach cursor change listeners to textarea
  const attachCursorListeners = () => {
    const textarea = getTextarea();
    if (!textarea || !onCursorChange) return;

    // Listen for cursor/selection changes
    textarea.addEventListener('click', handleCursorChange);
    textarea.addEventListener('keyup', handleCursorChange);
    textarea.addEventListener('select', handleCursorChange);
    textarea.addEventListener('focus', handleCursorChange);

    console.log('[EditorBinding] Cursor listeners attached');
  };

  const removeCursorListeners = () => {
    const textarea = getTextarea();
    if (!textarea) return;

    textarea.removeEventListener('click', handleCursorChange);
    textarea.removeEventListener('keyup', handleCursorChange);
    textarea.removeEventListener('select', handleCursorChange);
    textarea.removeEventListener('focus', handleCursorChange);

    console.log('[EditorBinding] Cursor listeners removed');
  };

  // Handler for Y.Text changes (from remote or undo/redo)
  const yTextObserver = (event: Y.YTextEvent) => {
    if (isUpdating) {
      // Skip if we're updating from local change
      return;
    }

    console.log('[EditorBinding] Y.Text changed from remote', {
      readOnly,
      length: yText.toString().length,
    });

    // Get current textarea
    const textarea = getTextarea();
    if (!textarea) {
      console.warn('[EditorBinding] No textarea found for cursor adjustment');
    }

    // Store current cursor position (only if not read-only)
    const cursorPosition =
      textarea && !readOnly ? textarea.selectionStart : null;

    // Update editor value
    const newValue = yText.toString();
    isUpdating = true;
    onLocalChange(newValue);
    isUpdating = false;

    // Restore cursor position with adjustment (only if not read-only)
    if (textarea && cursorPosition !== null && !readOnly) {
      requestAnimationFrame(() => {
        const adjustment = calculateCursorAdjustment(cursorPosition, event);
        const newPosition = Math.max(0, cursorPosition + adjustment);
        textarea.setSelectionRange(newPosition, newPosition);
      });
    }
  };

  // Observe Y.Text changes - ALWAYS observe, even in read-only mode
  yText.observe(yTextObserver);

  // Attach cursor listeners (with a delay to ensure textarea is rendered)
  setTimeout(attachCursorListeners, 100);

  // Method to handle local editor changes
  const handleLocalChange = (newValue: string) => {
    if (isUpdating) return;

    // Block local changes if read-only
    if (readOnly) {
      console.log('[EditorBinding] Blocked local change - read-only mode');
      return;
    }

    const oldValue = yText.toString();

    if (oldValue === newValue) return;

    console.log('[EditorBinding] Local change detected');

    // Update Y.Text
    isUpdating = true;
    yText.doc!.transact(() => {
      applyStringDiff(yText, oldValue, newValue);
    });

    // Also update the local React state immediately
    // This ensures the component re-renders with the new value
    onLocalChange(newValue);

    isUpdating = false;
  };

  // Cleanup
  const destroy = () => {
    yText.unobserve(yTextObserver);
    removeCursorListeners();
    console.log('[EditorBinding] Destroyed');
  };

  return {
    yText,
    onLocalChange: handleLocalChange,
    getValue,
    getTextarea,
    onCursorChange: throttledCursorUpdate || undefined,
    destroy,
  };
}

/**
 * Hook-style binding creator for use with React components
 */
export function useEditorBinding(
  yText: Y.Text | null,
  value: string,
  onChange: (value: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement>
): {
  handleChange: (value: string) => void;
  binding: EditorBinding | null;
} {
  const [binding, setBinding] = React.useState<EditorBinding | null>(null);

  React.useEffect(() => {
    if (!yText) return;

    const newBinding = createEditorBinding(
      yText,
      () => value,
      onChange,
      () => textareaRef.current
    );

    setBinding(newBinding);

    return () => {
      newBinding.destroy();
      setBinding(null);
    };
  }, [yText]);

  const handleChange = React.useCallback(
    (newValue: string) => {
      if (binding) {
        binding.onLocalChange(newValue);
      } else {
        // Fallback if binding not ready
        onChange(newValue);
      }
    },
    [binding, onChange]
  );

  return { handleChange, binding };
}
