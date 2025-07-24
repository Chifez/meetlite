import { Handle, Position, NodeProps } from '@xyflow/react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

type NodeData = {
  label: string;
  nodeType?: 'input' | 'default' | 'output' | 'group';
};

const nodeColors = {
  input: 'bg-green-50 border-green-500',
  default: 'bg-blue-50 border-blue-500',
  output: 'bg-orange-50 border-orange-500',
  group: 'bg-purple-50 border-purple-500',
};

const handleStyles = {
  input: '!bg-green-500',
  default: '!bg-blue-500',
  output: '!bg-orange-500',
  group: '!bg-purple-500',
};

export const CustomNode = ({ data, isConnectable }: NodeProps) => {
  const nodeData = data as NodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label);

  const onLabelClick = useCallback((evt: React.MouseEvent) => {
    evt.stopPropagation();
    setIsEditing(true);
  }, []);

  const onLabelChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      setLabel(evt.target.value);
    },
    []
  );

  const onLabelBlur = useCallback(() => {
    setIsEditing(false);
    nodeData.label = label;
  }, [nodeData, label]);

  const type = nodeData.nodeType || 'default';

  return (
    <div
      className={cn(
        'px-4 py-2 shadow-lg rounded-lg border-2',
        'transition-all duration-200 cursor-grab active:cursor-grabbing',
        'hover:shadow-xl hover:scale-105',
        nodeColors[type]
      )}
    >
      {/* Input Handle */}
      {type !== 'output' && (
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          className={cn('w-3 h-3 -ml-0.5', handleStyles[type])}
        />
      )}

      <div className="flex items-center min-w-[100px]">
        {isEditing ? (
          <input
            type="text"
            value={label}
            onChange={onLabelChange}
            onBlur={onLabelBlur}
            className="text-sm p-1 border rounded bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            autoFocus
          />
        ) : (
          <div
            className="text-sm font-medium cursor-text w-full text-center"
            onDoubleClick={onLabelClick}
          >
            {label}
          </div>
        )}
      </div>

      {/* Output Handle */}
      {type !== 'input' && (
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className={cn('w-3 h-3 -mr-0.5', handleStyles[type])}
        />
      )}
    </div>
  );
};
