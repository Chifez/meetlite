import { DragEvent } from 'react';

interface NodeType {
  type: string;
  label: string;
  nodeType?: 'input' | 'output' | 'default';
}

const nodeTypes: NodeType[] = [
  { type: 'input', label: 'Input', nodeType: 'input' },
  { type: 'process', label: 'Process' },
  { type: 'output', label: 'Output', nodeType: 'output' },
];

export const NodeToolbar = () => {
  const onDragStart = (
    event: DragEvent<HTMLDivElement>,
    nodeType: NodeType
  ) => {
    const data = {
      type: 'custom',
      data: {
        label: nodeType.label,
        type: nodeType.nodeType || 'default',
      },
    };

    event.dataTransfer.setData('application/reactflow', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-10">
      <h3 className="text-sm font-semibold mb-2">Node Types</h3>
      <div className="flex flex-col gap-2">
        {nodeTypes.map((type) => (
          <div
            key={type.type}
            className={`p-2 border-2 rounded cursor-move text-sm
              ${
                type.nodeType === 'input'
                  ? 'bg-green-100 border-green-200'
                  : type.nodeType === 'output'
                  ? 'bg-orange-100 border-orange-200'
                  : 'bg-blue-100 border-blue-200'
              }
            `}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
          >
            {type.label}
          </div>
        ))}
      </div>
    </div>
  );
};
