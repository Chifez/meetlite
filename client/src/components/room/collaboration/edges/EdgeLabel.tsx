import { useState, useCallback } from 'react';
import { getBezierPath, EdgeProps } from '@xyflow/react';

export const EdgeLabel = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  data,
  selected,
}: EdgeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [labelText, setLabelText] = useState(label as string);

  const onDoubleClick = useCallback((evt: React.MouseEvent) => {
    evt.preventDefault();
    evt.stopPropagation();
    setIsEditing(true);
  }, []);

  const onChange = useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
    setLabelText(evt.target.value);
  }, []);

  const onBlur = useCallback(() => {
    setIsEditing(false);
    // We update the edge label here through the custom event
    const event = new CustomEvent('edge:labelchange', {
      detail: { id, label: labelText },
    });
    window.dispatchEvent(event);
  }, [id, labelText]);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <g
        transform={`translate(${labelX - 10} ${labelY - 10})`}
        className="nodrag nopan"
      >
        {isEditing ? (
          <foreignObject
            width={100}
            height={40}
            x={-40}
            y={-15}
            className="nodrag nopan"
            style={{ background: 'transparent' }}
          >
            <div className="h-full flex items-center">
              <input
                value={labelText}
                onChange={onChange}
                onBlur={onBlur}
                className="w-full px-2 py-1 text-xs border rounded shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </foreignObject>
        ) : (
          <foreignObject
            width={100}
            height={40}
            x={-40}
            y={-15}
            className="nodrag nopan"
            style={{ background: 'transparent' }}
          >
            <div
              onDoubleClick={onDoubleClick}
              className="h-full flex items-center justify-center"
            >
              <span className="px-2 py-1 text-xs bg-white rounded shadow-sm cursor-pointer hover:bg-gray-50">
                {labelText || 'Label'}
              </span>
            </div>
          </foreignObject>
        )}
      </g>
    </>
  );
};
