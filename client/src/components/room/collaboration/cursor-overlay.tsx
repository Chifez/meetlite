import React, { useState, useEffect, useRef } from 'react';
import { RemoteCursor } from './remote-cursor';
import { UserAwareness } from '@/lib/yjs/types';
import {
  calculateCursorPosition,
  measureEditorMetrics,
} from '@/lib/yjs/cursor-utils';

interface CursorOverlayProps {
  remoteUsers: UserAwareness[];
  editorValue: string;
  className?: string;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({
  remoteUsers,
  editorValue,
  className = '',
}) => {
  const [editorMetrics, setEditorMetrics] = useState<{
    charWidth: number;
    lineHeight: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure editor metrics when component mounts
  useEffect(() => {
    const textarea = document.getElementById(
      'code-editor-textarea'
    ) as HTMLTextAreaElement;
    if (!textarea) {
      console.warn('[CursorOverlay] Textarea not found');
      return;
    }

    const metrics = measureEditorMetrics(textarea);
    setEditorMetrics(metrics);

    console.log('[CursorOverlay] Editor metrics:', metrics);
  }, []);

  // Filter remote users with valid cursor positions
  const usersWithCursors = remoteUsers.filter(
    (user) =>
      user.cursor &&
      user.cursor.line !== undefined &&
      user.cursor.column !== undefined
  );

  console.log('[CursorOverlay] Remote users with cursors:', {
    total: remoteUsers.length,
    withCursors: usersWithCursors.length,
    users: usersWithCursors.map((u) => ({
      name: u.userName,
      cursor: u.cursor,
    })),
  });

  if (!editorMetrics) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 40 }}
    >
      {usersWithCursors.map((user) => {
        if (!user.cursor) return null;

        const { line, column } = user.cursor;
        const { x, y } = calculateCursorPosition(
          line,
          column,
          editorMetrics.lineHeight,
          editorMetrics.charWidth
        );

        return (
          <RemoteCursor
            key={user.userId}
            userName={user.userName || user.userEmail || 'Anonymous'}
            userColor={user.userColor}
            x={x}
            y={y}
            isVisible={user.isActive}
          />
        );
      })}
    </div>
  );
};
