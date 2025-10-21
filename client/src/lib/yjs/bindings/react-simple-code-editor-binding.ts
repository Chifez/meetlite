import * as Y from 'yjs';
import React from 'react';
import {
  applyStringDiff,
  calculateCursorAdjustment,
} from './text-delta-converter';

/**
 * React Simple Code Editor Yjs Binding
 * Synchronizes Y.Text with react-simple-code-editor component
 */

export interface EditorBinding {
  yText: Y.Text;
  onLocalChange: (value: string) => void;
  getValue: () => string;
  getTextarea: () => HTMLTextAreaElement | null;
  destroy: () => void;
}

export function createEditorBinding(
  yText: Y.Text,
  getValue: () => string,
  onLocalChange: (value: string) => void,
  getTextarea: () => HTMLTextAreaElement | null
): EditorBinding {
  let isUpdating = false;

  // Handler for Y.Text changes (from remote or undo/redo)
  const yTextObserver = (event: Y.YTextEvent) => {
    if (isUpdating) {
      // Skip if we're updating from local change
      return;
    }

    console.log('[EditorBinding] Y.Text changed from remote');

    // Get current textarea
    const textarea = getTextarea();
    if (!textarea) {
      console.warn('[EditorBinding] No textarea found for cursor adjustment');
    }

    // Store current cursor position
    const cursorPosition = textarea ? textarea.selectionStart : null;

    // Update editor value
    const newValue = yText.toString();
    isUpdating = true;
    onLocalChange(newValue);
    isUpdating = false;

    // Restore cursor position with adjustment
    if (textarea && cursorPosition !== null) {
      requestAnimationFrame(() => {
        const adjustment = calculateCursorAdjustment(cursorPosition, event);
        const newPosition = Math.max(0, cursorPosition + adjustment);
        textarea.setSelectionRange(newPosition, newPosition);
      });
    }
  };

  // Observe Y.Text changes
  yText.observe(yTextObserver);

  // Method to handle local editor changes
  const handleLocalChange = (newValue: string) => {
    if (isUpdating) return;

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
    console.log('[EditorBinding] Destroyed');
  };

  return {
    yText,
    onLocalChange: handleLocalChange,
    getValue,
    getTextarea,
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
