import React, { useMemo } from 'react';
import { ReactFlowInstance } from '@xyflow/react';
import { WorkflowUserAwareness } from '@/hooks/use-workflow-awareness';

interface WorkflowCursorOverlayProps {
  remoteUsers: WorkflowUserAwareness[];
  reactFlowInstance: ReactFlowInstance | null;
}

interface RemoteCursorProps {
  userName: string;
  userColor: string;
  x: number;
  y: number;
}

/**
 * Remote cursor indicator for workflow canvas
 */
const RemoteCursor: React.FC<RemoteCursorProps> = ({
  userName,
  userColor,
  x,
  y,
}) => {
  return (
    <div
      className="absolute pointer-events-none transition-all duration-75 ease-out"
      style={{
        left: x,
        top: y,
        transform: 'translate(-2px, -2px)',
        zIndex: 1000,
      }}
    >
      {/* Cursor arrow */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))',
        }}
      >
        <path
          d="M5.65 2.05L21.35 12.55C21.95 12.95 21.75 13.85 21.05 13.95L13.05 15.05L9.55 22.05C9.25 22.65 8.35 22.55 8.15 21.95L4.15 3.15C4.05 2.45 4.95 1.95 5.65 2.05Z"
          fill={userColor}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>

      {/* User name label */}
      <div
        className="absolute left-5 top-4 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
        style={{
          backgroundColor: userColor,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
        }}
      >
        {userName}
      </div>
    </div>
  );
};

/**
 * Overlay component that renders all remote user cursors on the workflow canvas
 */
export const WorkflowCursorOverlay: React.FC<WorkflowCursorOverlayProps> = ({
  remoteUsers,
  reactFlowInstance,
}) => {
  // Convert flow coordinates to screen coordinates for each cursor
  const cursorElements = useMemo(() => {
    if (!reactFlowInstance) return null;

    return remoteUsers.map((user) => {
      if (!user.cursor) return null;

      try {
        // Convert flow coordinates to screen/viewport coordinates
        const screenPosition = reactFlowInstance.flowToScreenPosition({
          x: user.cursor.x,
          y: user.cursor.y,
        });

        return (
          <RemoteCursor
            key={user.userId}
            userName={user.userName || user.userEmail || 'Anonymous'}
            userColor={user.userColor}
            x={screenPosition.x}
            y={screenPosition.y}
          />
        );
      } catch (error) {
        // flowToScreenPosition can throw if viewport is not ready
        return null;
      }
    });
  }, [remoteUsers, reactFlowInstance]);

  if (!remoteUsers.length) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 50 }}
    >
      {cursorElements}
    </div>
  );
};

export default WorkflowCursorOverlay;

