import React, { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CodeEditorComponent } from './code-editor';
import { CodeEditorToolbar } from './code-editor-toolbar';
import { useRoom } from '@/contexts/room-context';
import { useAuth } from '@/hooks/use-auth';
import { useYjsCode } from '@/hooks/yjs/use-yjs-code';
import { useYjsAwareness } from '@/hooks/yjs/use-yjs-awareness';

interface CodePanelProps {
  className?: string;
}

export const CodePanel: React.FC<CodePanelProps> = ({ className }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket, collaborationState, changeCodeLanguage, canEdit } = useRoom();
  const { user } = useAuth();

  const isPresenter = user?.id === collaborationState?.presenter?.userId;
  const canUserEdit = user?.id ? canEdit(user.id) : false;

  // Return early if not in code mode
  if (!socket || collaborationState?.mode !== 'code') {
    return null;
  }

  // Get current language from collaboration state
  const currentLanguage = collaborationState.codeData?.language || 'javascript';

  // Initialize Yjs for code editing (pure YJS, no legacy callbacks)
  const { yText, isReady, docId, setActive, updateCursor } = useYjsCode(
    roomId,
    collaborationState?.mode === 'code'
  );

  // Get awareness data for active editors
  const { activeUserCount, remoteUsers } = useYjsAwareness(docId, isReady);

  // Get code value from Y.Text - always use YJS as the source of truth
  const codeValue = isReady && yText ? yText.toString() : '';

  console.log('[CodePanel] Render state:', {
    isReady,
    hasYText: !!yText,
    codeLength: codeValue.length,
    language: currentLanguage,
  });

  // Set active status when component mounts/user starts editing
  useEffect(() => {
    if (canUserEdit) {
      setActive(true);
    }

    return () => {
      setActive(false);
    };
  }, [canUserEdit, setActive]);

  const handleLanguageChange = useCallback(
    (language: string) => {
      if (canUserEdit) {
        changeCodeLanguage(language);
      } else {
        console.log('[CodePanel] User cannot edit, language change blocked');
      }
    },
    [canUserEdit, changeCodeLanguage]
  );

  // Handle cursor position changes
  const handleCursorChange = useCallback(
    (line: number, column: number, index: number) => {
      console.log('[CodePanel] Cursor changed:', { line, column, index });
      updateCursor(line, column, index);
    },
    [updateCursor]
  );

  return (
    <div
      className={`h-full flex flex-col bg-white dark:bg-gray-900 ${className}`}
    >
      {/* Toolbar */}
      <CodeEditorToolbar
        language={currentLanguage}
        onLanguageChange={handleLanguageChange}
        canEdit={canUserEdit}
        activeEditors={[user?.name || user?.email || 'You']}
        activeUserCount={activeUserCount}
        isPresenter={isPresenter}
      />

      {/* Code Editor */}
      <div className="flex-1 min-h-0">
        {isReady ? (
          <CodeEditorComponent
            value={codeValue}
            yText={yText}
            language={currentLanguage}
            readOnly={!canUserEdit}
            placeholder={
              canUserEdit
                ? 'Start coding here...'
                : 'Code editor is in view-only mode'
            }
            theme="dark"
            onCursorChange={handleCursorChange}
            remoteUsers={remoteUsers}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700 mx-auto mb-2"></div>
              <p>Connecting to collaboration service...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
