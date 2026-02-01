import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRoom } from '@/contexts/room-context';
import { useAuth } from '@/hooks/use-auth';

export interface WorkflowCursor {
  x: number;
  y: number;
  timestamp: number;
}

export interface WorkflowUserAwareness {
  userId: string;
  userName: string;
  userEmail: string;
  userColor: string;
  cursor: WorkflowCursor | null;
  activeNodeId: string | null;
  lastActivity: number;
  isActive: boolean;
}

interface UseWorkflowAwarenessReturn {
  remoteUsers: WorkflowUserAwareness[];
  activeUserCount: number;
  updateCursor: (x: number, y: number) => void;
  updateActiveNode: (nodeId: string | null) => void;
  setActive: (isActive: boolean) => void;
}

// Throttle interval for cursor updates (60ms = ~16fps, smooth but efficient)
const CURSOR_THROTTLE_MS = 60;

// Inactivity timeout - hide cursor after 5 seconds of no movement
const INACTIVITY_TIMEOUT_MS = 5000;

// Generate consistent color from user ID
function generateUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Light Blue
    '#F8B739', // Orange
    '#52B788', // Green
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export const useWorkflowAwareness = (
  roomId: string | undefined,
  enabled: boolean = true
): UseWorkflowAwarenessReturn => {
  const { socket } = useRoom();
  const { user } = useAuth();
  const [remoteUsers, setRemoteUsers] = useState<WorkflowUserAwareness[]>([]);
  
  // Throttle tracking
  const lastCursorUpdate = useRef<number>(0);
  const pendingCursorUpdate = useRef<{ x: number; y: number } | null>(null);
  const throttleTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Local awareness state
  const localAwareness = useRef<{
    cursor: WorkflowCursor | null;
    activeNodeId: string | null;
    isActive: boolean;
  }>({
    cursor: null,
    activeNodeId: null,
    isActive: false,
  });

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (throttleTimeout.current) {
        clearTimeout(throttleTimeout.current);
      }
    };
  }, []);

  // Listen for workflow awareness updates from other users
  useEffect(() => {
    if (!socket || !roomId || !enabled) return;

    const handleWorkflowAwareness = (data: {
      userId: string;
      userName?: string;
      userEmail?: string;
      cursor?: WorkflowCursor | null;
      activeNodeId?: string | null;
      isActive?: boolean;
    }) => {
      // Ignore own updates
      if (data.userId === user?.id) return;

      setRemoteUsers((prev) => {
        const existingIndex = prev.findIndex((u) => u.userId === data.userId);
        const now = Date.now();

        const updatedUser: WorkflowUserAwareness = {
          userId: data.userId,
          userName: data.userName || data.userEmail || 'Anonymous',
          userEmail: data.userEmail || '',
          userColor: generateUserColor(data.userId),
          cursor: data.cursor || null,
          activeNodeId: data.activeNodeId || null,
          lastActivity: now,
          isActive: data.isActive !== false,
        };

        if (existingIndex >= 0) {
          const newUsers = [...prev];
          newUsers[existingIndex] = updatedUser;
          return newUsers;
        } else {
          return [...prev, updatedUser];
        }
      });
    };

    const handleUserLeft = (data: { oderId: string }) => {
      setRemoteUsers((prev) => prev.filter((u) => u.userId !== data.oderId));
    };

    socket.on('workflow:awareness', handleWorkflowAwareness);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('workflow:awareness', handleWorkflowAwareness);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, roomId, enabled, user?.id]);

  // Filter out inactive users
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteUsers((prev) =>
        prev.map((user) => ({
          ...user,
          isActive: now - user.lastActivity < INACTIVITY_TIMEOUT_MS,
        }))
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Throttled cursor update function
  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (!socket || !roomId || !enabled || !user) return;

      const now = Date.now();
      const timeSinceLastUpdate = now - lastCursorUpdate.current;

      // Store the pending update
      pendingCursorUpdate.current = { x, y };

      // If enough time has passed, send immediately
      if (timeSinceLastUpdate >= CURSOR_THROTTLE_MS) {
        lastCursorUpdate.current = now;
        
        const cursor: WorkflowCursor = {
          x,
          y,
          timestamp: now,
        };

        localAwareness.current.cursor = cursor;

        socket.emit('workflow:awareness', {
          roomId,
          cursor,
          activeNodeId: localAwareness.current.activeNodeId,
          isActive: true,
        });

        pendingCursorUpdate.current = null;
      } else if (!throttleTimeout.current) {
        // Schedule a delayed update
        throttleTimeout.current = setTimeout(() => {
          throttleTimeout.current = null;

          if (pendingCursorUpdate.current) {
            const { x, y } = pendingCursorUpdate.current;
            lastCursorUpdate.current = Date.now();

            const cursor: WorkflowCursor = {
              x,
              y,
              timestamp: Date.now(),
            };

            localAwareness.current.cursor = cursor;

            socket.emit('workflow:awareness', {
              roomId,
              cursor,
              activeNodeId: localAwareness.current.activeNodeId,
              isActive: true,
            });

            pendingCursorUpdate.current = null;
          }
        }, CURSOR_THROTTLE_MS - timeSinceLastUpdate);
      }
    },
    [socket, roomId, enabled, user]
  );

  // Update active node
  const updateActiveNode = useCallback(
    (nodeId: string | null) => {
      if (!socket || !roomId || !enabled) return;

      localAwareness.current.activeNodeId = nodeId;

      socket.emit('workflow:awareness', {
        roomId,
        cursor: localAwareness.current.cursor,
        activeNodeId: nodeId,
        isActive: true,
      });
    },
    [socket, roomId, enabled]
  );

  // Set active state
  const setActive = useCallback(
    (isActive: boolean) => {
      if (!socket || !roomId || !enabled) return;

      localAwareness.current.isActive = isActive;

      socket.emit('workflow:awareness', {
        roomId,
        cursor: isActive ? localAwareness.current.cursor : null,
        activeNodeId: isActive ? localAwareness.current.activeNodeId : null,
        isActive,
      });
    },
    [socket, roomId, enabled]
  );

  // Calculate active user count
  const activeUserCount = useMemo(() => {
    return remoteUsers.filter((u) => u.isActive).length + 1; // +1 for local user
  }, [remoteUsers]);

  // Filter to only active users with cursors
  const activeRemoteUsers = useMemo(() => {
    return remoteUsers.filter((u) => u.isActive && u.cursor);
  }, [remoteUsers]);

  return {
    remoteUsers: activeRemoteUsers,
    activeUserCount,
    updateCursor,
    updateActiveNode,
    setActive,
  };
};

export default useWorkflowAwareness;

