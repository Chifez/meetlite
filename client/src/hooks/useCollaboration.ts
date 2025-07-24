import { useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  CollaborationState,
  WorkflowData,
  Node,
  Edge,
} from '@/components/room/types';

interface UseCollaborationProps {
  socket: Socket | null;
  roomId: string | undefined;
}

interface WorkflowOperation {
  type: 'add_node' | 'update_node' | 'delete_node' | 'add_edge' | 'delete_edge';
  node?: Node;
  nodeId?: string;
  data?: Partial<Node>;
  edge?: Edge;
  edgeId?: string;
}

export const useCollaboration = ({ socket, roomId }: UseCollaborationProps) => {
  const [collaborationState, setCollaborationState] =
    useState<CollaborationState>({
      mode: 'none',
      activeTool: 'none',
      workflowData: null,
      whiteboardData: null,
    });

  const changeCollaborationMode = useCallback(
    (mode: 'none' | 'workflow' | 'whiteboard') => {
      if (!socket || !roomId) return;

      socket.emit('collaboration:mode', { roomId, mode });
    },
    [socket, roomId]
  );

  const sendWorkflowOperation = useCallback(
    (operation: WorkflowOperation) => {
      if (!socket || !roomId || collaborationState.mode !== 'workflow') return;

      socket.emit('workflow:operation', { roomId, operation });
    },
    [socket, roomId, collaborationState.mode]
  );

  const sendWhiteboardUpdate = useCallback(
    (update: unknown) => {
      if (!socket || !roomId || collaborationState.mode !== 'whiteboard')
        return;

      socket.emit('whiteboard:update', { roomId, update });
    },
    [socket, roomId, collaborationState.mode]
  );

  useEffect(() => {
    if (!socket) return;

    const handleCollaborationState = (state: CollaborationState) => {
      setCollaborationState(state);
    };

    const handleModeChanged = (data: {
      mode: 'none' | 'workflow' | 'whiteboard';
      activeTool: 'none' | 'workflow' | 'whiteboard';
    }) => {
      setCollaborationState((prev) => ({
        ...prev,
        mode: data.mode,
        activeTool: data.activeTool,
      }));
    };

    const handleWorkflowOperation = (data: {
      operation: WorkflowOperation;
      userId: string;
      timestamp: number;
    }) => {
      setCollaborationState((prev) => {
        if (!prev.workflowData) return prev;

        const newWorkflowData = applyWorkflowOperation(
          prev.workflowData,
          data.operation
        );
        return {
          ...prev,
          workflowData: {
            ...newWorkflowData,
            lastModified: new Date(data.timestamp),
            lastModifiedBy: data.userId,
          },
        };
      });
    };

    const handleWhiteboardUpdate = (data: {
      update: unknown;
      userId: string;
      timestamp: number;
      version: number;
    }) => {
      setCollaborationState((prev) => ({
        ...prev,
        whiteboardData: {
          version: data.version,
          lastModified: new Date(data.timestamp),
          lastModifiedBy: data.userId,
        },
      }));
    };

    socket.on('collaboration:state', handleCollaborationState);
    socket.on('collaboration:mode-changed', handleModeChanged);
    socket.on('workflow:operation', handleWorkflowOperation);
    socket.on('whiteboard:update', handleWhiteboardUpdate);

    return () => {
      socket.off('collaboration:state', handleCollaborationState);
      socket.off('collaboration:mode-changed', handleModeChanged);
      socket.off('workflow:operation', handleWorkflowOperation);
      socket.off('whiteboard:update', handleWhiteboardUpdate);
    };
  }, [socket]);

  return {
    collaborationState,
    changeCollaborationMode,
    sendWorkflowOperation,
    sendWhiteboardUpdate,
  };
};

// Helper function to apply workflow operations
function applyWorkflowOperation(
  workflowData: WorkflowData,
  operation: WorkflowOperation
): WorkflowData {
  const newData = { ...workflowData };

  switch (operation.type) {
    case 'add_node':
      if (operation.node) {
        newData.nodes = [...newData.nodes, operation.node];
      }
      break;
    case 'update_node':
      if (operation.nodeId && operation.data) {
        newData.nodes = newData.nodes.map((node) =>
          node.id === operation.nodeId ? { ...node, ...operation.data } : node
        );
      }
      break;
    case 'delete_node':
      if (operation.nodeId) {
        newData.nodes = newData.nodes.filter(
          (node) => node.id !== operation.nodeId
        );
        newData.edges = newData.edges.filter(
          (edge) =>
            edge.source !== operation.nodeId && edge.target !== operation.nodeId
        );
      }
      break;
    case 'add_edge':
      if (operation.edge) {
        newData.edges = [...newData.edges, operation.edge];
      }
      break;
    case 'delete_edge':
      if (operation.edgeId) {
        newData.edges = newData.edges.filter(
          (edge) => edge.id !== operation.edgeId
        );
      }
      break;
  }

  return newData;
}
