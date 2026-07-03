import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  addEdge,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Calendar, Mail, Globe, Video, Settings } from 'lucide-react';

// Responsive positioning function
const getResponsivePositions = () => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile) {
    // Mobile layout - tighter spacing, centered
    return {
      google: { x: 50, y: 30 },
      outlook: { x: 165, y: 30 },
      webRTC: { x: 280, y: 30 },
      settings: { x: 165, y: 160 },
      video: { x: 165, y: 280 },
    };
  }

  // Desktop layout - your original properly centered positions
  return {
    google: { x: 100, y: 50 },
    outlook: { x: 310, y: 50 },
    webRTC: { x: 520, y: 50 },
    settings: { x: 310, y: 220 },
    video: { x: 310, y: 390 },
  };
};

const createNodes = (positions: any, isMobile: boolean) => [
  // Integration nodes at the top
  {
    id: 'google',
    position: positions.google,
    data: {
      label: (
        <div className="flex flex-col items-center gap-2">
          <div
            className={`${
              isMobile ? 'size-10' : 'size-12'
            } rounded-full bg-card border border-border flex items-center justify-center shadow-md group hover:border-primary transition`}
          >
            <Calendar
              className={`${
                isMobile ? 'size-5' : 'size-6'
              } text-muted-foreground group-hover:text-primary transition`}
            />
          </div>
          <span
            className={`${
              isMobile ? 'text-[10px]' : 'text-xs'
            } text-center max-w-[100px] text-foreground`}
          >
            Google Calendar
          </span>
        </div>
      ),
    },
    style: { background: 'transparent', border: 'none' },
  },
  {
    id: 'outlook',
    position: positions.outlook,
    data: {
      label: (
        <div className="flex flex-col items-center gap-2">
          <div
            className={`${
              isMobile ? 'size-10' : 'size-12'
            } rounded-full bg-card border border-border flex items-center justify-center shadow-md group hover:border-primary transition`}
          >
            <Mail
              className={`${
                isMobile ? 'size-5' : 'size-6'
              } text-muted-foreground group-hover:text-primary transition`}
            />
          </div>
          <span
            className={`${
              isMobile ? 'text-[10px]' : 'text-xs'
            } text-center max-w-[100px] text-foreground`}
          >
            Outlook
          </span>
        </div>
      ),
    },
    style: { background: 'transparent', border: 'none' },
  },
  {
    id: 'webRTC',
    position: positions.webRTC,
    data: {
      label: (
        <div className="flex flex-col items-center gap-2">
          <div
            className={`${
              isMobile ? 'size-10' : 'size-12'
            } rounded-full bg-card border border-border flex items-center justify-center shadow-md group hover:border-primary transition`}
          >
            <Globe
              className={`${
                isMobile ? 'size-5' : 'size-6'
              } text-muted-foreground group-hover:text-primary transition`}
            />
          </div>
          <span
            className={`${
              isMobile ? 'text-[10px]' : 'text-xs'
            } text-center max-w-[100px] text-foreground`}
          >
            webRTC
          </span>
        </div>
      ),
    },
    style: { background: 'transparent', border: 'none' },
  },
  // Settings node in the middle (intersection point)
  {
    id: 'settings',
    position: positions.settings,
    data: {
      label: (
        <div
          className={`mx-auto flex items-center justify-center ${
            isMobile ? 'w-10 h-10' : 'w-12 h-12'
          } rounded-full bg-card border-2 border-primary shadow-lg`}
        >
          <Settings
            className={`${
              isMobile ? 'w-5 h-5' : 'w-6 h-6'
            } text-primary animate-spin`}
            style={{ animationDuration: '3s' }}
          />
        </div>
      ),
    },
    style: { background: 'transparent', border: 'none' },
  },
  // Video node at the bottom
  {
    id: 'video',
    position: positions.video,
    data: {
      label: (
        <div
          className={`mx-auto flex items-center justify-center ${
            isMobile ? 'w-12 h-12' : 'w-14 h-14'
          } rounded-full bg-card border-2 border-primary shadow-lg`}
        >
          <Video
            className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-primary`}
          />
        </div>
      ),
    },
    style: { background: 'transparent', border: 'none' },
  },
];

const initialEdges = [
  // Integrations → Settings
  {
    id: 'google-settings',
    source: 'google',
    target: 'settings',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#9333ea', strokeWidth: 1.5, strokeDasharray: '6 4' },
    pathOptions: { borderRadius: 40 },
  },
  {
    id: 'outlook-settings',
    source: 'outlook',
    target: 'settings',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#9333ea', strokeWidth: 1.5, strokeDasharray: '6 4' },
    pathOptions: { borderRadius: 40 },
  },
  {
    id: 'webRTC-settings',
    source: 'webRTC',
    target: 'settings',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#9333ea', strokeWidth: 1.5, strokeDasharray: '6 4' },
    pathOptions: { borderRadius: 40 },
  },
  // Settings → Video
  {
    id: 'settings-video',
    source: 'settings',
    target: 'video',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#9333ea', strokeWidth: 1.5, strokeDasharray: '6 4' },
    pathOptions: { borderRadius: 40 },
  },
];

const BrowserMockup = ({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="w-full max-w-5xl mx-auto rounded-lg overflow-hidden shadow-2xl border border-border">
      {/* Browser chrome */}
      <div className="bg-muted px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-card rounded-md px-4 py-1 text-sm text-muted-foreground border border-border">
            <span className="text-muted-foreground/50">◉</span> {url}
          </div>
        </div>
      </div>
      {/* Content */}
      {children}
    </div>
  );
};

const IntegrationsBeam = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const positions = getResponsivePositions();
  const initialNodes = createNodes(positions, isMobile);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when screen size changes
  useEffect(() => {
    const newNodes = createNodes(positions, isMobile);
    setNodes(newNodes);
  }, [isMobile, setNodes]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            animated: true,
            style: {
              stroke: '#9333ea',
              strokeWidth: 1.5,
              strokeDasharray: '6 4',
            },
            pathOptions: { borderRadius: 40 },
          },
          eds
        )
      ),
    [setEdges]
  );

  return (
    <BrowserMockup url="meetlite.app/integrations">
      <div
        className={`${
          isMobile ? 'h-[400px]' : 'h-[550px]'
        } w-full flex items-center justify-center bg-gradient-to-br from-background to-muted/20`}
      >
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
            nodesFocusable={false}
            zoomOnScroll={false}
            panOnScroll={true}
            panOnDrag={true}
            className="bg-transparent"
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={12}
              size={1}
              className="opacity-20"
            />
          </ReactFlow>
        </ReactFlowProvider>
        <style>{`
          .react-flow__node {
            cursor: grab;
          }
          .react-flow__node:active {
            cursor: grabbing;
          }
          .react-flow__node.dragging {
            box-shadow: none !important;
            outline: none !important;
          }
          .react-flow__node.selected {
            box-shadow: none !important;
            outline: none !important;
          }
          .react-flow__node:hover {
            box-shadow: none !important;
          }
        `}</style>
      </div>
    </BrowserMockup>
  );
};

export default IntegrationsBeam;
