import React, { useState, useCallback, useEffect } from 'react';
import { CodeEditorComponent } from './code-editor';
import { CodeEditorToolbar } from './code-editor-toolbar';
import { useRoom } from '@/contexts/room-context';
import { useAuth } from '@/hooks/use-auth';
import { CodeUpdate } from '@/components/room/types';

interface CodePanelProps {
  className?: string;
}

export const CodePanel: React.FC<CodePanelProps> = ({ className }) => {
  const {
    socket,
    collaborationState,
    sendCodeUpdate,
    changeCodeLanguage,
    canEdit,
  } = useRoom();
  const { user } = useAuth();
  const [activeEditors, setActiveEditors] = useState<string[]>([]);

  const isPresenter = user?.id === collaborationState?.presenter?.userId;
  const canUserEdit = user?.id ? canEdit(user.id) : false;

  // Return early if not in code mode
  if (!socket || collaborationState?.mode !== 'code') {
    return null;
  }

  // Get current code data
  const codeData = collaborationState.codeData || {
    code: '',
    language: 'javascript',
    version: 0,
    lastModified: new Date(),
    lastModifiedBy: null,
  };

  // Debounced code update
  const debouncedUpdateCode = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (newCode: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (canUserEdit && newCode !== codeData.code) {
            const update: CodeUpdate = {
              code: newCode,
              language: codeData.language,
              version: codeData.version,
              timestamp: Date.now(),
              userId: socket?.user?.id || '',
            };
            sendCodeUpdate(update);
          }
        }, 300);
      };
    })(),
    [
      canUserEdit,
      codeData.code,
      codeData.language,
      codeData.version,
      sendCodeUpdate,
      socket?.user?.id,
    ]
  );

  const handleCodeChange = useCallback(
    (newCode: string) => {
      debouncedUpdateCode(newCode);
    },
    [debouncedUpdateCode]
  );

  const handleLanguageChange = useCallback(
    (language: string) => {
      if (canUserEdit) {
        changeCodeLanguage(language);
      } else {
        console.log('User cannot edit, language change blocked');
      }
    },
    [canUserEdit, changeCodeLanguage]
  );

  // Listen for active editors (placeholder - would be implemented with real-time presence)
  useEffect(() => {
    // This would be replaced with actual presence tracking
    setActiveEditors([socket?.user?.id || '']);
  }, [socket?.user?.id]);

  return (
    <div
      className={`h-full flex flex-col bg-white dark:bg-gray-900 ${className}`}
    >
      {/* Toolbar */}
      <CodeEditorToolbar
        language={codeData.language}
        onLanguageChange={handleLanguageChange}
        canEdit={canUserEdit}
        activeEditors={activeEditors}
        isPresenter={isPresenter}
      />

      {/* Code Editor */}
      <div className="flex-1 min-h-0">
        <CodeEditorComponent
          value={codeData.code}
          onChange={handleCodeChange}
          language={codeData.language}
          readOnly={!canUserEdit}
          placeholder={
            canUserEdit
              ? 'Start coding here...'
              : 'Code editor is in view-only mode'
          }
          theme="dark"
        />
      </div>
    </div>
  );
};
