import React, { useRef, useEffect, useState } from 'react';
import CodeEditor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import * as Y from 'yjs';
import { createEditorBinding } from '@/lib/yjs/bindings/react-simple-code-editor-binding';
import { CursorOverlay } from './cursor-overlay';
import { UserAwareness } from '@/lib/yjs/types';

interface CodeEditorProps {
  value: string;
  yText?: Y.Text | null;
  language: string;
  readOnly?: boolean;
  placeholder?: string;
  theme?: 'light' | 'dark';
  onCursorChange?: (line: number, column: number, index: number) => void;
  remoteUsers?: UserAwareness[];
}

export const CodeEditorComponent: React.FC<CodeEditorProps> = ({
  value,
  yText = null,
  language,
  readOnly = false,
  placeholder = 'Start coding...',
  theme = 'dark',
  onCursorChange,
  remoteUsers = [],
}) => {
  const [localValue, setLocalValue] = useState(value);
  const bindingRef = useRef<ReturnType<typeof createEditorBinding> | null>(
    null
  );

  // Initialize Yjs binding
  useEffect(() => {
    if (!yText) {
      bindingRef.current = null;
      return;
    }

    // Create binding even in read-only mode to receive remote updates
    const binding = createEditorBinding(
      yText,
      () => localValue,
      (newValue) => {
        setLocalValue(newValue);
      },
      () =>
        document.getElementById('code-editor-textarea') as HTMLTextAreaElement,
      readOnly, // Pass readOnly flag to binding
      onCursorChange // Pass cursor change callback
    );

    bindingRef.current = binding;

    // Sync initial value
    const yTextValue = yText.toString();
    if (yTextValue) {
      setLocalValue(yTextValue);
    }

    return () => {
      binding.destroy();
      bindingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yText, readOnly]);

  // Update local value when prop value changes (fallback)
  useEffect(() => {
    if (!yText) {
      setLocalValue(value);
    }
  }, [value, yText]);

  // Handle local changes
  const handleChange = (newValue: string) => {
    // Don't allow changes if read-only
    if (readOnly) {
      return;
    }

    if (bindingRef.current) {
      // Use Yjs binding
      bindingRef.current.onLocalChange(newValue);
    } else {
      // Fallback to regular state update
      setLocalValue(newValue);
    }
  };
  const getLanguage = (lang: string) => {
    // Only use languages that are available in core Prism.js
    switch (lang) {
      case 'javascript':
        return languages.javascript;
      case 'css':
        return languages.css;
      case 'html':
      case 'markup':
        return languages.markup; // HTML is aliased as markup in core Prism
      case 'json':
        return languages.json;
      default:
        // Fallback to JavaScript for unsupported languages
        return languages.javascript;
    }
  };

  const getThemeStyles = () => {
    if (theme === 'light') {
      return {
        backgroundColor: '#ffffff',
        color: '#000000',
        selection: '#b3d4fc',
        lineNumbers: '#666666',
      };
    } else {
      return {
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        selection: '#264f78',
        lineNumbers: '#858585',
      };
    }
  };

  const themeStyles = getThemeStyles();

  return (
    <div className="h-full w-full relative">
      <CodeEditor
        value={localValue}
        onValueChange={handleChange}
        highlight={(code) => highlight(code, getLanguage(language), language)}
        padding={10}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 14,
          backgroundColor: themeStyles.backgroundColor,
          color: themeStyles.color,
          minHeight: '100%',
          lineHeight: '1.5',
        }}
        textareaClassName="focus:outline-none resize-none"
        preClassName="focus:outline-none"
        textareaId="code-editor-textarea"
      />

      {/* Remote cursors overlay */}
      <CursorOverlay remoteUsers={remoteUsers} editorValue={localValue} />
    </div>
  );
};
