import { useCallback, useState, DragEvent, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Connection,
  Edge,
  Node,
  addEdge,
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
  const { socket, collaborationState, sendWorkflowOperation } = useRoom();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>('smoothstep');
  const reactFlowInstance = useReactFlow();

  // Handle node changes (movement, deletion, etc)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Handle edge changes (deletion, selection)
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // Listen for edge label changes
  useEffect(() => {
    const handleEdgeLabelChange = (event: Event) => {
      const { id, label } = (event as CustomEvent).detail;
      setEdges((eds) =>
        eds.map((e) =>
          e.id === id ? { ...e, label, labelStyle: { fontSize: 12 } } : e
        )
      );
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
  }, []);

  // Handle node connection
  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        const newEdge: Edge = {
          id: `e${params.source}-${params.target}`,
          source: params.source,
          target: params.target,
          type: 'custom',
          markerEnd: defaultEdgeOptions.markerEnd,
          style: { ...defaultEdgeOptions.style, type: edgeStyle },
          animated: defaultEdgeOptions.animated,
          label: 'Label',
          labelStyle: { fontSize: 12 },
        };
        setEdges((eds) => addEdge(newEdge, eds));
      }
    },
    [edgeStyle]
  );

  const createNode = useCallback((type: NodeType) => {
    const position = {
      x: Math.random() * 500,
      y: Math.random() * 500,
    };

    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: 'custom',
      position,
      data: {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        nodeType: type,
      },
    };

    setNodes((nds) => [...nds, newNode]);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData(
        'application/reactflow'
      ) as NodeType;
      if (!type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `node_${Date.now()}`,
        type: 'custom',
        position,
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          nodeType: type,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance]
  );

  if (!socket || collaborationState?.mode !== 'workflow') {
    return null;
  }

  return (
    <div className={className}>
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
