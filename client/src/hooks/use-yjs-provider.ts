import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { YjsProvider } from '@/lib/yjs/yjs-provider';
import { documentManager } from '@/lib/yjs/yjs-document-manager';
import { awarenessManager } from '@/lib/yjs/yjs-awareness-manager';

/**
 * Hook to initialize Yjs provider for a room
 * Should be called once at the room level
 */
export function useYjsProvider(
  socket: Socket | null,
  roomId: string | undefined,
  userId: string | undefined,
  userName: string | undefined,
  userEmail: string | undefined
) {
  const providerRef = useRef<YjsProvider | null>(null);

  useEffect(() => {
    if (!socket || !roomId || !userId || !userName) {
      return;
    }

    // Only log in development to reduce console noise
    if (process.env.NODE_ENV === 'development') {
      console.log('[useYjsProvider] Initializing for room:', roomId);
    }

    // Create provider
    const provider = new YjsProvider({
      socket,
      roomId,
      userId,
      userName,
      userEmail,
    });

    // Set provider in document manager
    documentManager.setProvider(provider);

    // Connect provider
    provider.connect();

    providerRef.current = provider;

    // Cleanup
    return () => {
      provider.disconnect();
      documentManager.destroyRoomDocuments(roomId);
      awarenessManager.clearAll();
      providerRef.current = null;
    };
  }, [socket, roomId, userId, userName, userEmail]);

  return {
    provider: providerRef.current,
    isConnected: providerRef.current?.connected || false,
  };
}
