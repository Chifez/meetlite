import React, { useRef, useMemo } from 'react';
import { RemoteCursor } from './remote-cursor';
import { UserAwareness } from '@/lib/yjs/types';
import {
  getCursorPixelPositionFromIndex,
  getEditorScrollPosition,
} from '@/lib/yjs/cursor-utils';

interface CursorOverlayProps {
  remoteUsers: UserAwareness[];
  editorValue: string;
  className?: string;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({
  remoteUsers,
  editorValue: _editorValue,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize filtered users with valid cursor positions to prevent unnecessary re-renders
  const usersWithCursors = useMemo(() => {
    return remoteUsers.filter(
      (user) => user.cursor && user.cursor.index !== undefined
    );
  }, [remoteUsers]);

  // Memoize cursor calculations to prevent unnecessary recalculations
  // This must be before the conditional return to follow Rules of Hooks
  const cursorElements = useMemo(() => {
    if (!containerRef.current) return null;

    // Get the editor element (parent of the overlay)
    const editorElement = containerRef.current.parentElement;
    if (!editorElement) return null;

    // Get scroll position
    const { scrollTop, scrollLeft } = getEditorScrollPosition(editorElement);

    return usersWithCursors.map((user) => {
      if (!user.cursor) return null;

      const { index } = user.cursor;

      // Get pixel position from character index using Range API
      const position = getCursorPixelPositionFromIndex(
        editorElement,
        index,
        scrollTop,
        scrollLeft
      );

      if (!position) return null;

      return (
        <RemoteCursor
          key={user.userId}
          userName={user.userName || user.userEmail || 'Anonymous'}
          userColor={user.userColor}
          x={position.x}
          y={position.y}
          isVisible={user.isActive}
        />
      );
    });
  }, [usersWithCursors]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 40 }}
    >
      {cursorElements}
    </div>
  );
};
