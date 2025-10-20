import React from 'react';
import CodeEditor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  readOnly?: boolean;
  placeholder?: string;
  theme?: 'light' | 'dark';
}

export const CodeEditorComponent: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  readOnly = false,
  placeholder = 'Start coding...',
  theme = 'dark',
}) => {
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
    <div className="h-full w-full">
      <CodeEditor
        value={value}
        onValueChange={onChange}
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
      />
    </div>
  );
};
