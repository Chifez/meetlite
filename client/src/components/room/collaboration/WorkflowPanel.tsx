import { useCallback, useState, DragEvent, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRoom } from '@/contexts/RoomContext';
import { CustomNode } from './nodes/CustomNode';
import { EdgeLabel } from './edges/EdgeLabel';
import { Button } from '@/components/ui/button';
import { Plus, Settings2, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface WorkflowPanelProps {
  className?: string;
}

type EdgeStyle = 'default' | 'straight' | 'step' | 'smoothstep' | 'bezier';
type NodeType = 'input' | 'default' | 'output' | 'group';

interface NodeData {
  label: string;
  nodeType: NodeType;
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
  const { socket, collaborationState, sendWorkflowOperation, canEdit } =
    useRoom();
  const [nodes, setNodes] = useState<Node<NodeData | any>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>('smoothstep');
  const reactFlowInstance = useReactFlow();
  const isInitialized = useRef(false);

  // Check if current user can edit
  const canUserEdit = socket?.user?.id ? canEdit(socket.user.id) : true;

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
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          nodeType: type,
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
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          nodeType: type,
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

  if (!socket || collaborationState?.mode !== 'workflow') {
    return null;
  }

  return (
    <div className={`${className} ${!canUserEdit && 'cursor-not-allowed'}`}>
      <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
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
          deleteKeyCode="Delete"
          snapToGrid
          snapGrid={[20, 20]}
        >
          <Background />
          <Controls />
          <Panel
            position="top-left"
            className="flex gap-2 bg-white p-2 rounded shadow-lg"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Node
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => createNode('input')}>
                  Input Node
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => createNode('default')}>
                  Default Node
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => createNode('output')}>
                  Output Node
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => createNode('group')}>
                  Group Node
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setEdgeStyle('default')}>
                  Default Edge
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEdgeStyle('straight')}>
                  Straight Edge
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEdgeStyle('step')}>
                  Step Edge
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEdgeStyle('smoothstep')}>
                  Smooth Step Edge
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEdgeStyle('bezier')}>
                  Bezier Edge
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
