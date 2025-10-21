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

  // Initialize Yjs for code editing
  const { yText, isReady, docId, setActive } = useYjsCode(
    roomId,
    collaborationState?.mode === 'code'
  );

  // Get awareness data for active editors
  const { activeUserCount } = useYjsAwareness(docId, isReady);

  // Get current code data (fallback if Yjs not ready)
  const codeData = collaborationState.codeData || {
    code: '',
    language: 'javascript',
    version: 0,
    lastModified: new Date(),
    lastModifiedBy: null,
  };

  // Get code value from Y.Text if ready, otherwise fallback
  const codeValue = isReady && yText ? yText.toString() : codeData.code;

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
        console.log('User cannot edit, language change blocked');
      }
    },
    [canUserEdit, changeCodeLanguage]
  );

  return (
    <div
      className={`h-full flex flex-col bg-white dark:bg-gray-900 ${className}`}
    >
      {/* Toolbar */}
      <CodeEditorToolbar
        language={codeData.language}
        onLanguageChange={handleLanguageChange}
        canEdit={canUserEdit}
        activeEditors={[user?.name || user?.email || 'You']}
        activeUserCount={activeUserCount}
        isPresenter={isPresenter}
      />

      {/* Code Editor */}
      <div className="flex-1 min-h-0">
        <CodeEditorComponent
          value={codeValue}
          yText={yText}
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
