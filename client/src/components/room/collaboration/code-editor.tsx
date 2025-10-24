import React, { useRef, useEffect, useState } from 'react';
import CodeEditor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import * as Y from 'yjs';
import { createEditorBinding } from '@/lib/yjs/bindings/react-simple-code-editor-binding';
import { CursorOverlay } from './cursor-overlay';
import { UserAwareness } from '@/lib/yjs/types';
import './code-editor.css';

// Import Prism.js CSS theme for syntax highlighting
import 'prismjs/themes/prism-tomorrow.css';

// Import additional language support in correct dependency order
// Note: Core languages (markup, css, clike, javascript) are already loaded
// Only import language components that are NOT in core
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-typescript'; // Depends on JavaScript (core)
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java'; // Depends on clike (core)
import 'prismjs/components/prism-csharp'; // Depends on clike (core)
import 'prismjs/components/prism-markup-templating'; // Required for PHP
import 'prismjs/components/prism-php'; // Depends on markup-templating and clike
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go'; // Depends on clike (core)
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';

interface CodeEditorProps {
  value: string;
  yText?: Y.Text | null;
  language: string;
  readOnly?: boolean;
  placeholder?: string;
  theme?: 'light' | 'dark';
  onCursorChange?: (index: number) => void;
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
    // Map language names to Prism.js language objects
    const languageMap: Record<string, any> = {
      javascript: languages.javascript || languages.js,
      typescript: languages.typescript || languages.ts,
      js: languages.javascript,
      ts: languages.typescript,
      css: languages.css,
      html: languages.markup,
      markup: languages.markup,
      json: languages.json,
      python: languages.python || languages.py,
      py: languages.python,
      java: languages.java,
      csharp: languages.csharp || languages.cs,
      cs: languages.csharp,
      'c#': languages.csharp,
      php: languages.php,
      ruby: languages.ruby || languages.rb,
      rb: languages.ruby,
      go: languages.go,
      rust: languages.rust || languages.rs,
      rs: languages.rust,
      sql: languages.sql,
    };

    const selectedLanguage = languageMap[lang.toLowerCase()];

    // Fallback to JavaScript if language not found or undefined
    if (!selectedLanguage) {
      console.warn(
        `[CodeEditor] Language '${lang}' not found, falling back to JavaScript`
      );
      return languages.javascript;
    }

    return selectedLanguage;
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

  // Safe highlight function with error handling and line numbers
  // Highlight with line numbers (CodeSandbox approach)
  const hightlightWithLineNumbers = (input: string, lang: any): string => {
    try {
      if (!lang) {
        console.warn(
          `[CodeEditor] No language grammar found for '${language}'`
        );
        return input;
      }

      // First highlight the code
      const highlightedCode = highlight(input, lang, language);

      // Split by actual newlines (not word wrapping)
      return highlightedCode
        .split('\n')
        .map(
          (line: string, i: number) =>
            `<span class='editorLineNumber' style="color: ${
              themeStyles.lineNumbers
            }">${i + 1}</span>${line}`
        )
        .join('\n');
    } catch (error) {
      console.error(`[CodeEditor] Error highlighting code:`, error);
      return input;
    }
  };

  return (
    <div className="h-full w-full relative">
      <CodeEditor
        value={localValue}
        onValueChange={handleChange}
        highlight={(code) =>
          hightlightWithLineNumbers(code, getLanguage(language))
        }
        padding={10}
        readOnly={readOnly}
        placeholder={placeholder}
        className="editor"
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

      {/* Max LOC info at bottom-right */}
      <div
        className="absolute bottom-2 right-2 pointer-events-none select-none text-xs opacity-50"
        style={{
          color: themeStyles.lineNumbers,
          fontFamily: '"Fira code", "Fira Mono", monospace',
          zIndex: 30,
        }}
      >
        max LOC &lt;1000
      </div>
    </div>
  );
};
