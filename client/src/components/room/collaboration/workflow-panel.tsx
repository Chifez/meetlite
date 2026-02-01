import { useCallback, useState, DragEvent, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  Connection,
  Edge,
  Node,
  NodeTypes,
  ReactFlowProvider,
  Panel,
  useReactFlow,
  MarkerType,
  ConnectionMode,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  EdgeTypes,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRoom } from '@/contexts/room-context';
import { CustomNode } from '@/components/room/collaboration/nodes/custom-nodes';
import { EdgeLabel } from '@/components/room/collaboration/edges/edge-label';
import { NodeToolbar } from '@/components/room/collaboration/nodes/node-toolbar';
import { WorkflowCursorOverlay } from '@/components/room/collaboration/workflow-cursor-overlay';
import { useWorkflowAwareness } from '@/hooks/use-workflow-awareness';
import { Crown, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'react-router-dom';

interface WorkflowPanelProps {
  className?: string;
}

type EdgeStyle = 'default' | 'straight' | 'step' | 'smoothstep' | 'bezier';
type NodeType = 'input' | 'default' | 'output';

interface NodeData {
  nodeType: NodeType;
  title?: string;
  description?: string;
  tags?: string[];
  icon?: string;
  details?: Array<{
    label: string;
    value: string;
    icon?: string;
  }>;
}

// Define node types mapping
const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

// Define edge types mapping
const edgeTypes: EdgeTypes = {
  custom: EdgeLabel,
};

// Default edge options for smooth curves
const defaultEdgeOptions = {
  type: 'custom' as const,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
  },
  style: {
    strokeWidth: 2,
  },
  animated: true,
};

const Flow = ({ className }: WorkflowPanelProps) => {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket, collaborationState, sendWorkflowOperation, canEdit } =
    useRoom();
  const { user } = useAuth();
  const [nodes, setNodes] = useState<Node<NodeData | any>[]>([]);
  
  // Workflow awareness for cursor presence
  const { remoteUsers, updateCursor, setActive } = useWorkflowAwareness(
    roomId,
    collaborationState?.mode === 'workflow'
  );
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>('smoothstep');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const reactFlowInstance = useReactFlow();
  const isInitialized = useRef(false);

  // Check if current user can edit
  const canUserEdit = user?.id ? canEdit(user.id) : false;
  const isPresenter = user?.id === collaborationState?.presenter?.userId;

  // Handle node changes (movement, deletion, etc)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply changes locally first
      setNodes((nds) => applyNodeChanges(changes, nds));

      // Only send operations if user can edit
      if (!canUserEdit) return;

      // Process each change
      changes.forEach((change) => {
        if (change.type === 'remove') {
          // For delete operations, send immediately
          sendWorkflowOperation({
            type: 'delete_node',
            nodeId: change.id,
          });
        } else if (
          change.type === 'position' &&
          change.position &&
          !change.dragging
        ) {
          // For position updates, only send when dragging ends
          const updatedNode = nodes.find((n) => n.id === change.id);
          if (updatedNode) {
            const { id, type, data } = updatedNode;
            sendWorkflowOperation({
              type: 'update_node',
              nodeId: id,
              node: { id, type, position: change.position, data },
            });
          }
        }
      });
    },
    [nodes, sendWorkflowOperation, canUserEdit]
  );

  // Sync with collaboration state
  useEffect(() => {
    if (!collaborationState?.workflowData) return;

    const currentNodes = collaborationState.workflowData.nodes || [];
    const currentEdges = collaborationState.workflowData.edges || [];

    // Only apply remote changes
    if (!isInitialized.current) {
      isInitialized.current = true;
      setNodes(currentNodes);
      setEdges(currentEdges);
    } else if (
      collaborationState.workflowData.lastModifiedBy !== socket?.user?.id
    ) {
      setNodes(currentNodes);
      setEdges(currentEdges);
    }
  }, [collaborationState?.workflowData, socket?.user?.id]);

  // Handle edge changes (deletion, selection)
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Let React Flow handle the state changes internally
      setEdges((eds) => applyEdgeChanges(changes, eds));

      // Only send operations if user can edit
      if (!canUserEdit) return;

      // Send operations for specific changes
      changes.forEach((change) => {
        if (change.type === 'remove') {
          sendWorkflowOperation({
            type: 'delete_edge',
            edgeId: change.id,
          });
        }
      });
    },
    [sendWorkflowOperation, canUserEdit]
  );

  // Listen for edge label changes
  useEffect(() => {
    const handleEdgeLabelChange = (event: Event) => {
      const { id, label } = (
        event as CustomEvent<{ id: string; label: string }>
      ).detail;
      const updatedEdge = edges.find((e) => e.id === id);
      if (updatedEdge) {
        const newEdge = {
          ...updatedEdge,
          label,
          labelStyle: { fontSize: 12 },
        };
        // Update local state
        setEdges((eds) => eds.map((e) => (e.id === id ? newEdge : e)));
        // Send update
        sendWorkflowOperation({
          type: 'update_edge',
          edgeId: id,
          edge: newEdge,
        });
      }
    };

    window.addEventListener(
      'edge:labelchange',
      handleEdgeLabelChange as EventListener
    );
    return () => {
      window.removeEventListener(
        'edge:labelchange',
        handleEdgeLabelChange as EventListener
      );
    };
  }, [edges, sendWorkflowOperation]);

  // Handle node connection
  const onConnect = useCallback(
    (params: Connection) => {
      if (!canUserEdit) return;

      if (params.source && params.target) {
        const newEdge: Edge = {
          id: `e${params.source}-${params.target}`,
          source: params.source,
          target: params.target,
          type: 'custom',
          markerEnd: defaultEdgeOptions.markerEnd,
          style: { ...defaultEdgeOptions.style },
          animated: defaultEdgeOptions.animated,
          label: 'Label',
          labelStyle: { fontSize: 12 },
        };

        // Send update first
        sendWorkflowOperation({
          type: 'add_edge',
          edge: newEdge,
        });

        // Then update local state
        setEdges((eds) => [...eds, newEdge]);
      }
    },
    [edgeStyle, sendWorkflowOperation, canUserEdit]
  );

  const createNode = useCallback(
    (type: NodeType) => {
      if (!canUserEdit) return;

      const position = {
        x: Math.random() * 500,
        y: Math.random() * 500,
      };

      const newNode: Node<NodeData | any> = {
        id: `node_${Date.now()}`,
        type: 'custom',
        position,
        data: {
          nodeType: type,
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          description: `A ${type} node for workflow processing`,
          tags: [type],
          details: [
            { label: 'Type', value: type },
            { label: 'Status', value: 'Ready' },
          ],
        },
      };

      // Send operation first
      sendWorkflowOperation({
        type: 'add_node',
        node: newNode,
      });

      // Then update local state
      setNodes((nds) => [...nds, newNode]);
    },
    [sendWorkflowOperation, canUserEdit]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (!canUserEdit) return;

      event.preventDefault();

      const type = event.dataTransfer.getData(
        'application/reactflow'
      ) as NodeType;
      if (!type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node<NodeData | any> = {
        id: `node_${Date.now()}`,
        type: 'custom',
        position,
        data: {
          nodeType: type,
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          description: `A ${type} node for workflow processing`,
          tags: [type],
          details: [
            { label: 'Type', value: type },
            { label: 'Status', value: 'Ready' },
          ],
        },
      };

      // Send operation first
      sendWorkflowOperation({
        type: 'add_node',
        node: newNode,
      });

      // Then update local state
      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance, sendWorkflowOperation, canUserEdit]
  );

  // Set active status when component mounts/unmounts
  useEffect(() => {
    if (collaborationState?.mode === 'workflow') {
      setActive(true);
    }
    return () => {
      setActive(false);
    };
  }, [collaborationState?.mode, setActive]);

  // Handle mouse move for cursor tracking
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      
      // Convert screen coordinates to flow coordinates
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      updateCursor(position.x, position.y);
    },
    [reactFlowInstance, updateCursor]
  );

  if (!socket || collaborationState?.mode !== 'workflow') {
    return null;
  }

  return (
    <div className={className}>
      <div
        ref={reactFlowWrapper}
        className="h-full w-full relative"
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMouseMove={handleMouseMove}
      >
        {/* Remote user cursors overlay */}
        <WorkflowCursorOverlay
          remoteUsers={remoteUsers}
          reactFlowInstance={reactFlowInstance}
        />
        
        {/* Add overlay to prevent interactions when user can't edit */}
        {!canUserEdit && (
          <div className="absolute inset-0 bg-transparent z-10 pointer-events-none" />
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionMode={ConnectionMode.Loose}
          fitView
          deleteKeyCode={canUserEdit ? 'Delete' : null}
          snapToGrid
          snapGrid={[20, 20]}
          nodesDraggable={canUserEdit}
          nodesConnectable={canUserEdit}
          elementsSelectable={canUserEdit}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          panOnScroll={true}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color={isDarkMode ? '#555' : '#aaa'}
            style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }}
          />
          <Controls>
            <ControlButton
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={
                isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'
              }
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </ControlButton>
          </Controls>

          {/* Node Toolbar - Only show if user can edit */}
          {canUserEdit && (
            <Panel position="top-left">
              <NodeToolbar
                onCreateNode={createNode}
                onEdgeStyleChange={setEdgeStyle}
              />
            </Panel>
          )}

          {/* Permission Badge - positioned next to the panel */}
          <Panel position="top-right" className="pt-4">
            <div className="flex items-center gap-2">
              {isPresenter && <Crown className="h-4 w-4 text-yellow-600" />}
              <Badge
                variant={canUserEdit ? 'default' : 'secondary'}
                className="text-xs"
              >
                {isPresenter
                  ? 'Presenter'
                  : canUserEdit
                  ? 'Can Edit'
                  : 'View Only'}
              </Badge>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
};

export const WorkflowPanel = (props: WorkflowPanelProps) => {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
};
