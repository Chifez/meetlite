import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { useCallback, useEffect, useRef } from 'react';
import { useRoom } from '@/contexts/RoomContext';

interface WhiteboardPanelProps {
  className?: string;
}

export const WhiteboardPanel = ({ className }: WhiteboardPanelProps) => {
  const { socket, collaborationState, sendWhiteboardUpdate } = useRoom();
  const editorRef = useRef<any>(null);

  // Create a unique persistence key based on room ID
  const persistenceKey = socket ? `whiteboard-${socket.id}` : undefined;

  // Handle store changes
  const handleMount = useCallback(
    (editor: any) => {
      editorRef.current = editor;
      if (socket && collaborationState?.mode === 'whiteboard') {
        const snapshot = editor.store.getSnapshot();
        sendWhiteboardUpdate(snapshot);
      }
    },
    [socket, collaborationState?.mode, sendWhiteboardUpdate]
  );

  // Handle incoming updates
  useEffect(() => {
    if (!socket || !editorRef.current) return;

    const handleWhiteboardUpdate = (update: any) => {
      if (editorRef.current) {
        editorRef.current.store.mergeRemoteChanges(() => {
          // Apply the update to the store
          editorRef.current?.store.loadSnapshot(update);
        });
      }
    };

    socket.on('whiteboard:update', handleWhiteboardUpdate);

    return () => {
      socket.off('whiteboard:update', handleWhiteboardUpdate);
    };
  }, [socket]);

  if (!socket || collaborationState?.mode !== 'whiteboard') {
    return null;
  }

  return (
    <div className={className}>
      <Tldraw persistenceKey={persistenceKey} onMount={handleMount} />
    </div>
  );
};
