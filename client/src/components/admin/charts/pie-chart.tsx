import { useMemo, useState } from 'react';
import { calculatePieSlices } from './chart-utils';

interface PieChartData {
  name: string;
  value: number;
}

interface PieChartProps {
  data: PieChartData[];
  height?: number;
  colors?: string[];
  showLabels?: boolean;
  innerRadius?: number; // For donut chart
}

const DEFAULT_COLORS = [
  '#8884d8', // Purple
  '#82ca9d', // Green
  '#ffc658', // Orange
  '#ff7c7c', // Red
];

export function PieChart({
  data,
  height = 300,
  colors = DEFAULT_COLORS,
  showLabels = true,
  innerRadius = 0,
}: PieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const radius = useMemo(() => {
    const maxRadius = Math.min(height - 100, 80); // Leave space for legend
    return maxRadius;
  }, [height]);

  const slices = useMemo(() => {
    // Filter out zero-value items before calculating slices
    const nonZeroData = data.filter((item) => item.value > 0);
    return calculatePieSlices(nonZeroData, radius, innerRadius);
  }, [data, radius, innerRadius]);

  const svgSize = useMemo(() => Math.min(height - 100, 200), [height]); // Reserve space for legend

  if (data.length === 0 || slices.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }
  const viewBoxStr = `${-radius - 20} ${-radius - 20} ${(radius + 20) * 2} ${
    (radius + 20) * 2
  }`;

  return (
    <div
      className="w-full flex flex-col items-center justify-center"
      style={{ height }}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={viewBoxStr}
        className="overflow-visible"
      >
        {/* Slices */}
        {slices.map((slice, index) => {
          const color =
            colors[index % colors.length] ||
            DEFAULT_COLORS[index % DEFAULT_COLORS.length];
          const isHovered = hoveredIndex === index;

          return (
            <g
              key={index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer transition-transform duration-200"
              style={{
                transform: isHovered
                  ? `translate(${slice.labelX * 0.05}px, ${
                      slice.labelY * 0.05
                    }px)`
                  : 'none',
                transformOrigin: '0 0',
              }}
            >
              <path
                d={slice.path}
                fill={color}
                opacity={isHovered ? 0.9 : 1}
                stroke="#ffffff"
                strokeWidth={2}
                className="transition-all duration-200"
              />
              {showLabels && slice.percentage > 5 && (
                <text
                  x={slice.labelX}
                  y={slice.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs font-medium pointer-events-none"
                  fill="#000000"
                >
                  {`${slice.percentage.toFixed(0)}%`}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 mt-2 w-full max-h-[120px] px-2">
        {data.map((item, index) => {
          const color = colors[index % colors.length];
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={index}
              className="flex items-center justify-between text-xs py-0.5"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: color,
                    opacity: isHovered ? 0.9 : 1,
                  }}
                />
                <span className="text-muted-foreground truncate">
                  {item.name}
                </span>
              </div>
              <span
                className="font-medium text-foreground flex-shrink-0 ml-2"
                style={{
                  opacity: isHovered ? 1 : 0.8,
                }}
              >
                {item.value.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
