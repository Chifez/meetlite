import { useState, useCallback, useEffect } from 'react';
import { SOCKET_EVENTS, COLLABORATION_MODES } from '@/lib/constants';
import {
  CollaborationState,
  WorkflowData,
  WorkflowOperation,
  WhiteboardUpdate,
  ExtendedSocket,
} from '@/components/room/types';

interface UseCollaborationProps {
  socket: ExtendedSocket | null;
  roomId: string | undefined;
}

export const useCollaboration = ({ socket, roomId }: UseCollaborationProps) => {
  const [collaborationState, setCollaborationState] =
    useState<CollaborationState>({
      mode: COLLABORATION_MODES.NONE,
      activeTool: COLLABORATION_MODES.NONE,
      workflowData: null,
      whiteboardData: null,
      codeData: null,
      screenSharingUserId: null,
      presenter: {
        userId: null,
        mode: null,
        collaborationSettings: {
          mode: 'allow-edit',
          allowedUsers: [],
        },
      },
    });
  const [operationVersion, setOperationVersion] = useState(0);

  // Request state sync when initializing
  const requestStateSync = useCallback(() => {
    if (!socket || !roomId) return;

    // Request overall collaboration state (mode, presenter, screen sharing)
    socket.emit(SOCKET_EVENTS.COLLAB_REQUEST_STATE, { roomId });

    // Request tool-specific data
    socket.emit(SOCKET_EVENTS.WORKFLOW_REQUEST_SYNC, { roomId });
    socket.emit(SOCKET_EVENTS.WHITEBOARD_REQUEST_SYNC, { roomId });
    socket.emit(SOCKET_EVENTS.CODE_REQUEST_SYNC, { roomId });
  }, [socket, roomId]);

  const changeCollaborationMode = useCallback(
    (mode: 'none' | 'workflow' | 'whiteboard' | 'code') => {
      if (!socket || !roomId) return;
      socket.emit(SOCKET_EVENTS.COLLAB_MODE, { roomId, mode });
    },
    [socket, roomId]
  );

  const applyWorkflowOperation = useCallback(
    (workflowData: WorkflowData, operation: WorkflowOperation) => {
      const newData = { ...workflowData };

      // Initialize arrays if they don't exist
      if (!newData.nodes) newData.nodes = [];
      if (!newData.edges) newData.edges = [];

      switch (operation.type) {
        case 'add_node':
          if (operation.node) {
            const existingNodeIndex = newData.nodes.findIndex(
              (n) => n.id === operation.node!.id
            );
            if (existingNodeIndex >= 0) {
              // Update existing node with new data
              newData.nodes[existingNodeIndex] = {
                ...newData.nodes[existingNodeIndex],
                ...operation.node,
              };
            } else {
              // Add new node
              newData.nodes = [...newData.nodes, operation.node];
            }
          }
          break;

        case 'update_node':
          if (operation.nodeId && (operation.data || operation.node)) {
            newData.nodes = newData.nodes.map((node) =>
              node.id === operation.nodeId
                ? { ...node, ...(operation.node || operation.data) }
                : node
            );
          }
          break;

        case 'delete_node':
          if (operation.nodeId) {
            newData.nodes = newData.nodes.filter(
              (node) => node.id !== operation.nodeId
            );
            // Also remove connected edges
            newData.edges = newData.edges.filter(
              (edge) =>
                edge.source !== operation.nodeId &&
                edge.target !== operation.nodeId
            );
          }
          break;

        case 'add_edge':
          if (operation.edge) {
            const existingEdgeIndex = newData.edges.findIndex(
              (e) => e.id === operation.edge!.id
            );
            if (existingEdgeIndex >= 0) {
              // Update existing edge with new data
              newData.edges[existingEdgeIndex] = {
                ...newData.edges[existingEdgeIndex],
                ...operation.edge,
              };
            } else {
              // Add new edge
              newData.edges = [...newData.edges, operation.edge];
            }
          }
          break;

        case 'update_edge':
          if (operation.edgeId && (operation.edgeData || operation.edge)) {
            newData.edges = newData.edges.map((edge) =>
              edge.id === operation.edgeId
                ? { ...edge, ...(operation.edge || operation.edgeData) }
                : edge
            );
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
    },
    []
  );

  const sendWorkflowOperation = useCallback(
    (operation: WorkflowOperation) => {
      if (!socket || !roomId || collaborationState.mode !== COLLABORATION_MODES.WORKFLOW) {
        console.warn('Cannot send workflow operation:', {
          socketConnected: !!socket,
          roomId,
          mode: collaborationState.mode,
        });
        return;
      }

      const versionedOperation = {
        ...operation,
        version: operationVersion + 1,
        timestamp: Date.now(),
      };

      // Update version before sending
      setOperationVersion((prev) => prev + 1);

      // Send operation
      socket.emit(SOCKET_EVENTS.WORKFLOW_OPERATION, {
        roomId,
        operation: versionedOperation,
      });

      // Apply operation locally immediately
      setCollaborationState((prev) => {
        if (!prev.workflowData) {
          return {
            ...prev,
            workflowData: {
              nodes: [],
              edges: [],
              version: versionedOperation.version,
              lastModified: new Date(versionedOperation.timestamp),
              lastModifiedBy: socket.user?.id,
            },
          };
        }

        const newWorkflowData = applyWorkflowOperation(
          prev.workflowData,
          versionedOperation
        );

        return {
          ...prev,
          workflowData: {
            ...newWorkflowData,
            version: versionedOperation.version,
            lastModified: new Date(versionedOperation.timestamp),
            lastModifiedBy: socket.user?.id,
          },
        };
      });
    },
    [
      socket,
      roomId,
      collaborationState.mode,
      operationVersion,
      applyWorkflowOperation,
    ]
  );

  const sendWhiteboardUpdate = useCallback(
    (update: WhiteboardUpdate) => {
      if (!socket || !roomId || collaborationState.mode !== COLLABORATION_MODES.WHITEBOARD)
        return;

      socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, { roomId, update });
    },
    [socket, roomId, collaborationState.mode]
  );

  // Handle whiteboard state sync request
  const requestWhiteboardSync = useCallback(() => {
    if (!socket || !roomId) return;
    socket.emit(SOCKET_EVENTS.WHITEBOARD_REQUEST_SYNC, { roomId });
  }, [socket, roomId]);

  // REMOVED: sendCodeUpdate - Code synchronization now handled by pure YJS
  // Code content is synchronized via YJS binary protocol (yjs:update events)
  // Only language changes use legacy events

  const changeCodeLanguage = useCallback(
    (language: string) => {
      if (!socket || !roomId) return;

      socket.emit(SOCKET_EVENTS.CODE_LANGUAGE_CHANGE, {
        roomId,
        language,
        userId: socket.user?.id,
        timestamp: Date.now(),
      });
    },
    [socket, roomId]
  );

  const requestCodeSync = useCallback(() => {
    if (!socket || !roomId) return;
    socket.emit(SOCKET_EVENTS.CODE_REQUEST_SYNC, { roomId });
  }, [socket, roomId]);

  // Presenter functionality
  const startPresenting = useCallback(
    (mode: 'workflow' | 'whiteboard' | 'code') => {
      if (!socket || !roomId) return;

      socket.emit(SOCKET_EVENTS.PRESENTATION_START, { roomId, mode });
    },
    [socket, roomId]
  );

  const stopPresenting = useCallback(() => {
    if (!socket || !roomId) return;

    socket.emit('presentation:stop', { roomId });
  }, [socket, roomId]);

  const updateCollaborationSettings = useCallback(
    (settings: {
      mode: 'view-only' | 'allow-edit' | 'selective-edit';
      allowedUsers?: string[];
    }) => {
      if (!socket || !roomId) return;

      socket.emit('presentation:settings', { roomId, settings });
    },
    [socket, roomId]
  );

  const canEdit = useCallback(
    (userId: string) => {
      const { presenter } = collaborationState;

      // If no presenter, everyone can edit
      if (!presenter.userId) return true;

      // If user is the presenter, they can always edit
      if (userId === presenter.userId) return true;

      const { mode, allowedUsers } = presenter.collaborationSettings;

      switch (mode) {
        case 'view-only':
          return false;
        case 'allow-edit':
          return true;
        case 'selective-edit':
          return allowedUsers.includes(userId);
        default:
          return true;
      }
    },
    [collaborationState]
  );

  useEffect(() => {
    if (!socket) return;

    const handleCollaborationState = (state: CollaborationState) => {
      setCollaborationState(state);
      if (state.workflowData?.version) {
        setOperationVersion(state.workflowData.version);
      }
    };

    const handleCollaborationModeChanged = (data: {
      mode: 'none' | 'workflow' | 'whiteboard' | 'code';
      activeTool: 'none' | 'workflow' | 'whiteboard' | 'code';
      presenter?: {
        userId: string | null;
        mode: 'workflow' | 'whiteboard' | 'code' | null;
        collaborationSettings: {
          mode: 'view-only' | 'allow-edit' | 'selective-edit';
          allowedUsers: string[];
        };
      };
      changedBy: string;
    }) => {
      setCollaborationState((prev) => ({
        ...prev,
        mode: data.mode,
        activeTool: data.activeTool,
        presenter: data.presenter || prev.presenter,
      }));
    };

    const handleCollaborationSettingsChanged = (data: {
      settings: {
        mode: 'view-only' | 'allow-edit' | 'selective-edit';
        allowedUsers: string[];
      };
      changedBy: string;
      timestamp: number;
    }) => {
      console.log('Collaboration settings changed:', data);
      setCollaborationState((prev) => {
        if (!prev.presenter) return prev;
        return {
          ...prev,
          presenter: {
            ...prev.presenter,
            collaborationSettings: data.settings,
          },
        };
      });
    };

    const handleWorkflowOperation = (data: {
      operation: WorkflowOperation;
      userId: string;
      timestamp: number;
      version: number;
    }) => {
      // Only apply operation if it's newer than our current version
      if (data.version <= operationVersion) {
        return;
      }

      setOperationVersion(data.version);

      setCollaborationState((prev) => {
        if (!prev.workflowData) {
          return {
            ...prev,
            workflowData: {
              nodes: [],
              edges: [],
              version: data.version,
              lastModified: new Date(data.timestamp),
              lastModifiedBy: data.userId,
            },
          };
        }

        const newWorkflowData = applyWorkflowOperation(
          prev.workflowData,
          data.operation
        );

        return {
          ...prev,
          workflowData: {
            ...newWorkflowData,
            version: data.version,
            lastModified: new Date(data.timestamp),
            lastModifiedBy: data.userId,
          },
        };
      });
    };

    const handleWhiteboardUpdate = (data: {
      update: WhiteboardUpdate;
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

    // REMOVED: handleCodeUpdate - Now using pure YJS for code synchronization
    // Code content is synchronized via YJS binary protocol
    // Only metadata (language, permissions) uses legacy events

    const handleCodeLanguageChange = (data: {
      language: string;
      userId: string;
      timestamp: number;
    }) => {
      setCollaborationState((prev) => {
        const newState = {
          ...prev,
          codeData: prev.codeData
            ? {
                ...prev.codeData,
                language: data.language,
                lastModified: new Date(data.timestamp),
                lastModifiedBy: data.userId,
              }
            : {
                // Create new codeData if it doesn't exist
                code: '',
                language: data.language,
                version: 0,
                lastModified: new Date(data.timestamp),
                lastModifiedBy: data.userId,
              },
        };
        return newState;
      });
    };

    // Handle room data event (includes collaboration state)
    const handleRoomData = (data: any) => {
      if (data.collaborationState) {
        setCollaborationState(data.collaborationState);
        if (data.collaborationState.workflowData?.version) {
          setOperationVersion(data.collaborationState.workflowData.version);
        }
      } else {
        // Fallback: request state sync if not included in room-data
        requestStateSync();
      }
    };

    // Request initial state sync (fallback)
    requestStateSync();

    socket.on(SOCKET_EVENTS.ROOM_DATA, handleRoomData);
    socket.on(SOCKET_EVENTS.COLLAB_STATE, handleCollaborationState);
    socket.on(SOCKET_EVENTS.COLLAB_MODE_CHANGED, handleCollaborationModeChanged);
    socket.on(
      'collaboration:settings-changed',
      handleCollaborationSettingsChanged
    );
    socket.on(SOCKET_EVENTS.WORKFLOW_OPERATION, handleWorkflowOperation);
    socket.on(SOCKET_EVENTS.WHITEBOARD_UPDATE, handleWhiteboardUpdate);
    // REMOVED: 'code:update' - Now using pure YJS for code synchronization
    socket.on(SOCKET_EVENTS.CODE_LANGUAGE_CHANGE, handleCodeLanguageChange);

    // Handle state sync response
    socket.on('workflow:state-sync', (state: CollaborationState) => {
      setCollaborationState(state);
      if (state.workflowData?.version) {
        setOperationVersion(state.workflowData.version);
      }
    });

    // Handle whiteboard state sync response
    socket.on('whiteboard:state-sync', (whiteboardData: any) => {
      setCollaborationState((prev) => ({
        ...prev,
        whiteboardData,
      }));
    });

    // Handle code state sync response
    socket.on('code:state-sync', (codeData: any) => {
      setCollaborationState((prev) => ({
        ...prev,
        codeData,
      }));
    });

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_DATA, handleRoomData);
      socket.off(SOCKET_EVENTS.COLLAB_STATE, handleCollaborationState);
      socket.off(SOCKET_EVENTS.COLLAB_MODE_CHANGED, handleCollaborationModeChanged);
      socket.off(
        'collaboration:settings-changed',
        handleCollaborationSettingsChanged
      );
      socket.off(SOCKET_EVENTS.WORKFLOW_OPERATION, handleWorkflowOperation);
      socket.off(SOCKET_EVENTS.WHITEBOARD_UPDATE, handleWhiteboardUpdate);
      // REMOVED: 'code:update' - Now using pure YJS for code synchronization
      socket.off(SOCKET_EVENTS.CODE_LANGUAGE_CHANGE, handleCodeLanguageChange);
      socket.off('workflow:state-sync');
      socket.off('whiteboard:state-sync');
      socket.off('code:state-sync');
    };
  }, [
    socket,
    operationVersion,
    applyWorkflowOperation,
    requestStateSync,
    collaborationState.codeData?.version,
  ]);

  return {
    collaborationState,
    changeCollaborationMode,
    sendWorkflowOperation,
    applyWorkflowOperation,
    requestWhiteboardSync,
    sendWhiteboardUpdate,
    // REMOVED: sendCodeUpdate - Code synchronization now handled by pure YJS
    changeCodeLanguage,
    requestCodeSync,
    startPresenting,
    stopPresenting,
    updateCollaborationSettings,
    canEdit,
  };
};
