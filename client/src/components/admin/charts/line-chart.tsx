import { useMemo, useState, useRef, useEffect, useId } from 'react';
import {
  calculateChartDimensions,
  getPlotArea,
  getDataRange,
  generateLinePath,
  generateAreaPath,
  findNearestPoint,
  formatYAxisLabel,
  type LineChartData,
} from './chart-utils';

interface LineChartProps {
  data: LineChartData[];
  dataKey: string;
  height?: number;
  color?: string;
  showGrid?: boolean;
  showArea?: boolean;
}

export function LineChart({
  data,
  dataKey,
  height = 300,
  color = 'hsl(var(--primary))',
  showGrid = true,
  showArea = true,
}: LineChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    value: number;
    label: string;
  } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const gradientId = useId();
  const [computedColor, setComputedColor] = useState<string>('#8884d8');

  // Extract computed color value for SVG gradient
  useEffect(() => {
    if (containerRef.current && typeof window !== 'undefined') {
      // Create a temporary element to get computed color
      const tempEl = document.createElement('div');
      tempEl.style.color = color;
      tempEl.style.position = 'absolute';
      tempEl.style.visibility = 'hidden';
      tempEl.style.opacity = '0';
      document.body.appendChild(tempEl);
      const computed = window.getComputedStyle(tempEl).color;
      document.body.removeChild(tempEl);
      
      // If we got a valid RGB color, use it; otherwise use fallback
      if (computed && computed !== 'rgba(0, 0, 0, 0)' && computed.startsWith('rgb')) {
        setComputedColor(computed);
      } else {
        // Fallback to a purple color that works in both themes
        setComputedColor('#8884d8');
      }
    }
  }, [color]);

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const dimensions = useMemo(
    () => calculateChartDimensions(containerWidth || 800, height),
    [containerWidth, height]
  );

  const plotArea = useMemo(() => getPlotArea(dimensions), [dimensions]);

  const range = useMemo(() => getDataRange(data, dataKey), [data, dataKey]);

  const linePath = useMemo(
    () => generateLinePath(data, dataKey, plotArea, range),
    [data, dataKey, plotArea, range]
  );

  const areaPath = useMemo(
    () => generateAreaPath(data, dataKey, plotArea, range),
    [data, dataKey, plotArea, range]
  );

  // Generate Y-axis ticks - step from 0 to max in 5 equal increments
  const yTicks = useMemo(() => {
    const tickCount = 5;
    const ticks = [];
    const maxValue = range.max;
    
    for (let i = 0; i <= tickCount; i++) {
      // Calculate value: 0, max/5, 2*max/5, 3*max/5, 4*max/5, max
      const value = (maxValue * i) / tickCount;
      
      // Round to appropriate decimal places
      let roundedValue: number;
      if (maxValue <= 1) {
        // For small values, round to 1 decimal place
        roundedValue = Math.round(value * 10) / 10;
      } else if (maxValue <= 10) {
        // For values up to 10, round to 1 decimal place
        roundedValue = Math.round(value * 10) / 10;
      } else {
        // For larger values, round to nearest integer
        roundedValue = Math.round(value);
      }
      
      const y =
        plotArea.y + plotArea.height - (plotArea.height * i) / tickCount;
      ticks.push({ value: roundedValue, y });
    }
    return ticks;
  }, [range, plotArea]);

  // Generate X-axis labels
  const xLabels = useMemo(() => {
    if (data.length === 0) return [];
    const labelCount = Math.min(6, data.length);
    const step = Math.max(1, Math.floor(data.length / labelCount));
    return data
      .filter((_, index) => index % step === 0 || index === data.length - 1)
      .map((d) => {
        const originalIndex = data.findIndex((item) => item === d);
        const x =
          plotArea.x +
          (plotArea.width * originalIndex) / (data.length - 1 || 1);
        return { label: d.label, x, index: originalIndex };
      });
  }, [data, plotArea]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const point = findNearestPoint(mouseX, data, dataKey, plotArea, range);
    setHoveredPoint(point);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  if (data.length === 0) {
    return (
      <div
        ref={containerRef}
        className="w-full flex flex-col items-center justify-center gap-2"
        style={{ height }}
      >
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <svg
            className="w-6 h-6 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground">No data available</p>
        <p className="text-xs text-muted-foreground">
          Data will appear here once available
        </p>
      </div>
    );
  }

  // Color is already in the correct format

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <svg
        width={dimensions.width || '100%'}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="overflow-visible"
      >
        <defs>
          <linearGradient
            id={`area-gradient-${gradientId}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={computedColor} stopOpacity={0.4} />
            <stop offset="100%" stopColor={computedColor} stopOpacity={0.1} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {showGrid &&
          yTicks.map((tick, index) => (
            <g key={index}>
              <line
                x1={plotArea.x}
                y1={tick.y}
                x2={plotArea.x + plotArea.width}
                y2={tick.y}
                stroke="hsl(var(--border))"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.3}
              />
            </g>
          ))}

        {/* Area under line */}
        {showArea && areaPath && (
          <path
            d={areaPath}
            fill={`url(#area-gradient-${gradientId})`}
            opacity={1}
          />
        )}

        {/* Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {data.map((d, index) => {
          const x =
            plotArea.x + (plotArea.width * index) / (data.length - 1 || 1);
          const value = Number(d[dataKey]) || 0;
          const y =
            plotArea.y +
            plotArea.height -
            (plotArea.height * (value - range.min)) / (range.max - range.min);
          const isHovered = hoveredPoint && Math.abs(x - hoveredPoint.x) < 5;

          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={isHovered ? 5 : 0}
              fill={color}
              className="transition-all duration-200"
            />
          );
        })}

        {/* Hover vertical line */}
        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            y1={plotArea.y}
            x2={hoveredPoint.x}
            y2={plotArea.y + plotArea.height}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.6}
          />
        )}

        {/* Y-axis */}
        <line
          x1={plotArea.x}
          y1={plotArea.y}
          x2={plotArea.x}
          y2={plotArea.y + plotArea.height}
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />

        {/* X-axis */}
        <line
          x1={plotArea.x}
          y1={plotArea.y + plotArea.height}
          x2={plotArea.x + plotArea.width}
          y2={plotArea.y + plotArea.height}
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />

        {/* Y-axis labels */}
        {yTicks.map((tick, index) => (
          <g key={index}>
            <text
              x={plotArea.x - 10}
              y={tick.y + 4}
              textAnchor="end"
              className="text-xs fill-muted-foreground"
            >
              {formatYAxisLabel(tick.value, range.max)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xLabels.map((label, index) => (
          <text
            key={index}
            x={label.x}
            y={plotArea.y + plotArea.height + 20}
            textAnchor="middle"
            className="text-xs fill-muted-foreground"
          >
            {label.label}
          </text>
        ))}

        {/* Tooltip */}
        {hoveredPoint && (
          <g>
            <defs>
              <filter
                id="tooltip-shadow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="4"
                  floodOpacity="0.2"
                />
              </filter>
            </defs>
            <rect
              x={hoveredPoint.x - 50}
              y={hoveredPoint.y - 35}
              width={100}
              height={30}
              rx={4}
              fill="var(--popover)"
              stroke="var(--border)"
              strokeWidth={1}
              opacity={0.98}
              filter="url(#tooltip-shadow)"
            />
            <foreignObject
              x={hoveredPoint.x - 50}
              y={hoveredPoint.y - 35}
              width={100}
              height={30}
              xmlns="http://www.w3.org/1999/xhtml"
              className="pointer-events-none"
            >
              <div
                className="flex flex-col items-center justify-center h-full text-xs px-2"
                style={{
                  color: 'var(--popover-foreground)',
                }}
              >
                <div className="font-medium text-center">
                  {hoveredPoint.label}
                </div>
                <div className="font-semibold text-center">
                  {hoveredPoint.value.toLocaleString()}
                </div>
              </div>
            </foreignObject>
          </g>
        )}
      </svg>
    </div>
  );
}
