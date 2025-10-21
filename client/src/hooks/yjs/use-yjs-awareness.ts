import { useState, useEffect } from 'react';
import { awarenessManager } from '@/lib/yjs/yjs-awareness-manager';
import { UserAwareness } from '@/lib/yjs/types';

/**
 * Hook for tracking user awareness (cursors, selections, active users)
 */
export function useYjsAwareness(docId: string | null, enabled: boolean = true) {
  const [remoteUsers, setRemoteUsers] = useState<UserAwareness[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserAwareness[]>([]);
  const [localState, setLocalState] = useState<UserAwareness | null>(null);

  useEffect(() => {
    if (!docId || !enabled) {
      setRemoteUsers([]);
      setActiveUsers([]);
      setLocalState(null);
      return;
    }

    console.log('[useYjsAwareness] Subscribing to awareness for docId:', docId);

    // Initial state
    const updateState = () => {
      const remote = awarenessManager.getRemoteUsers(docId);
      const active = awarenessManager.getActiveRemoteUsers(docId);
      const local = awarenessManager.getLocalState(docId);

      setRemoteUsers(Array.from(remote.values()));
      setActiveUsers(active);
      setLocalState(local);

      console.log('[useYjsAwareness] Updated state:', {
        remoteCount: remote.size,
        activeCount: active.length,
        hasLocal: !!local,
      });
    };

    // Initial update
    updateState();

    // Subscribe to changes
    const unsubscribe = awarenessManager.subscribe(docId, (changes) => {
      console.log('[useYjsAwareness] Awareness changed:', changes);
      updateState();
    });

    // Cleanup
    return () => {
      console.log('[useYjsAwareness] Unsubscribing');
      unsubscribe();
    };
  }, [docId, enabled]);

  return {
    remoteUsers,
    activeUsers,
    localState,
    activeUserCount: activeUsers.length + (localState ? 1 : 0),
  };
}
