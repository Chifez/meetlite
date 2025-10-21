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
      console.log(
        '[useYjsProvider] Not initializing - missing required params'
      );
      return;
    }

    console.log('[useYjsProvider] Initializing Yjs provider', {
      roomId,
      userId,
      userName,
    });

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

    console.log('[useYjsProvider] Provider connected');

    // Cleanup
    return () => {
      console.log('[useYjsProvider] Disconnecting provider');
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
