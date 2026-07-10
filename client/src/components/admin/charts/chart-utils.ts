export interface ChartPoint {
  x: number;
  y: number;
  value: number;
  label: string;
}

export interface ChartDimensions {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface LineChartData {
  [key: string]: string | number;
  label: string;
}

/**
 * Calculate chart dimensions and plot area
 */
export function calculateChartDimensions(
  containerWidth: number,
  height: number,
  margin = { top: 20, right: 20, bottom: 40, left: 50 }
): ChartDimensions {
  return {
    width: containerWidth,
    height,
    margin,
  };
}

/**
 * Calculate the plot area (where the chart actually draws)
 */
export function getPlotArea(dimensions: ChartDimensions) {
  return {
    x: dimensions.margin.left,
    y: dimensions.margin.top,
    width: dimensions.width - dimensions.margin.left - dimensions.margin.right,
    height:
      dimensions.height - dimensions.margin.top - dimensions.margin.bottom,
  };
}

/**
 * Calculate min/max values from data for scaling
 */
export function getDataRange(
  data: LineChartData[],
  dataKey: string
): { min: number; max: number } {
  if (!data || data.length === 0) {
    return { min: 0, max: 1 };
  }

  const values = data.map((d) => Number(d[dataKey]) || 0);
  const _min = Math.min(...values);
  let max = Math.max(...values);
  
  // If max is 0, use max of 1
  if (max === 0) {
    max = 1;
  }

  return {
    min: 0,
    max: max,
  };
}

/**
 * Scale a value to SVG coordinates
 */
export function scale(
  value: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number
): number {
  if (inputMax === inputMin) return outputMin;
  return (
    ((value - inputMin) / (inputMax - inputMin)) * (outputMax - outputMin) +
    outputMin
  );
}

/**
 * Generate SVG path for line chart
 */
export function generateLinePath(
  data: LineChartData[],
  dataKey: string,
  plotArea: ReturnType<typeof getPlotArea>,
  range: ReturnType<typeof getDataRange>
): string {
  if (data.length === 0) return '';

  const points = data.map((d, index) => {
    const x = scale(
      index,
      0,
      data.length - 1,
      plotArea.x,
      plotArea.x + plotArea.width
    );
    const y = scale(
      Number(d[dataKey]) || 0,
      range.min,
      range.max,
      plotArea.y + plotArea.height,
      plotArea.y
    );
    return { x, y, value: Number(d[dataKey]) || 0, label: d.label };
  });

  // Generate smooth path using quadratic curves
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const _prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    if (next) {
      // Use quadratic curve for smooth line
      const cpX = (curr.x + next.x) / 2;
      const cpY = curr.y;
      path += ` Q ${curr.x} ${curr.y} ${cpX} ${cpY}`;
    } else {
      // Last point
      path += ` L ${curr.x} ${curr.y}`;
    }
  }

  return path;
}

/**
 * Generate SVG path for area under the line
 */
export function generateAreaPath(
  data: LineChartData[],
  dataKey: string,
  plotArea: ReturnType<typeof getPlotArea>,
  range: ReturnType<typeof getDataRange>
): string {
  const linePath = generateLinePath(data, dataKey, plotArea, range);
  if (!linePath) return '';

  const _firstPoint = data[0];
  const _lastPoint = data[data.length - 1];
  const firstX = scale(
    0,
    0,
    data.length - 1,
    plotArea.x,
    plotArea.x + plotArea.width
  );
  const lastX = scale(
    data.length - 1,
    0,
    data.length - 1,
    plotArea.x,
    plotArea.x + plotArea.width
  );
  const baselineY = plotArea.y + plotArea.height;

  return `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
}

/**
 * Find the nearest data point to mouse X position
 */
export function findNearestPoint(
  mouseX: number,
  data: LineChartData[],
  dataKey: string,
  plotArea: ReturnType<typeof getPlotArea>,
  range: ReturnType<typeof getDataRange>
): ChartPoint | null {
  if (data.length === 0) return null;

  const pointWidth = plotArea.width / (data.length - 1 || 1);
  const index = Math.round((mouseX - plotArea.x) / pointWidth);
  const clampedIndex = Math.max(0, Math.min(data.length - 1, index));

  const point = data[clampedIndex];
  const x = scale(
    clampedIndex,
    0,
    data.length - 1,
    plotArea.x,
    plotArea.x + plotArea.width
  );
  const y = scale(
    Number(point[dataKey]) || 0,
    range.min,
    range.max,
    plotArea.y + plotArea.height,
    plotArea.y
  );

  return {
    x,
    y,
    value: Number(point[dataKey]) || 0,
    label: point.label,
  };
}

/**
 * Format Y-axis labels
 */
export function formatYAxisLabel(value: number, maxValue: number): string {
  if (maxValue >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (maxValue >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  // For values <= 1, show 1 decimal place; otherwise show as integer
  if (maxValue <= 1) {
    return value.toFixed(1);
  }
  if (maxValue <= 10) {
    // Show 1 decimal place for values up to 10
    return value.toFixed(1);
  }
  return value.toFixed(0);
}

/**
 * Calculate pie chart slice
 */
export interface PieSlice {
  name: string;
  value: number;
  percentage: number;
  startAngle: number;
  endAngle: number;
  largeArc: number;
  path: string;
  labelX: number;
  labelY: number;
}

export function calculatePieSlices(
  data: Array<{ name: string; value: number }>,
  radius: number,
  innerRadius: number = 0
): PieSlice[] {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return [];

  let currentAngle = -Math.PI / 2; // Start at top
  const centerX = 0;
  const centerY = 0;

  return data.map((item) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 2 * Math.PI;

    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;

    // Calculate outer arc coordinates
    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    // Calculate inner arc coordinates (for donut chart)
    const x3 = centerX + innerRadius * Math.cos(endAngle);
    const y3 = centerY + innerRadius * Math.sin(endAngle);
    const x4 = centerX + innerRadius * Math.cos(startAngle);
    const y4 = centerY + innerRadius * Math.sin(startAngle);

    // Large arc flag (1 if angle > 180 degrees)
    const largeArc = angle > Math.PI ? 1 : 0;

    // Generate path
    let path = '';

    // Handle full circle (360 degrees) - use two semicircles to avoid precision issues
    // When angle is exactly 2π, start and end points are the same, causing invalid SVG path
    const isFullCircle = Math.abs(angle - 2 * Math.PI) < 0.0001;

    if (innerRadius > 0) {
      // Donut chart
      if (isFullCircle) {
        // Full circle donut: use two semicircles for outer, two for inner
        const topX = centerX;
        const topY = centerY - radius;
        const bottomX = centerX;
        const bottomY = centerY + radius;
        const innerTopX = centerX;
        const innerTopY = centerY - innerRadius;
        const innerBottomX = centerX;
        const innerBottomY = centerY + innerRadius;
        // Outer circle: two semicircles
        // Inner circle: two semicircles (counter-clockwise to close the donut)
        path = `M ${topX} ${topY} A ${radius} ${radius} 0 1 1 ${bottomX} ${bottomY} A ${radius} ${radius} 0 1 1 ${topX} ${topY} L ${innerTopX} ${innerTopY} A ${innerRadius} ${innerRadius} 0 1 0 ${innerBottomX} ${innerBottomY} A ${innerRadius} ${innerRadius} 0 1 0 ${innerTopX} ${innerTopY} Z`;
      } else {
        path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
      }
    } else {
      // Pie chart
      if (isFullCircle) {
        // Full circle pie: use two semicircles
        // Start at center, line to top, then draw two 180-degree arcs to complete the circle
        const topX = centerX;
        const topY = centerY - radius;
        const bottomX = centerX;
        const bottomY = centerY + radius;
        // First semicircle: top -> bottom (clockwise)
        // Second semicircle: bottom -> top (clockwise)
        path = `M ${centerX} ${centerY} L ${topX} ${topY} A ${radius} ${radius} 0 1 1 ${bottomX} ${bottomY} A ${radius} ${radius} 0 1 1 ${topX} ${topY} Z`;
      } else {
        path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      }
    }

    // Label position (middle of slice)
    const labelAngle = startAngle + angle / 2;
    const labelRadius =
      innerRadius > 0
        ? (radius + innerRadius) / 2 // Middle of donut ring
        : radius * 0.7; // 70% of radius for pie chart
    const labelX = centerX + labelRadius * Math.cos(labelAngle);
    const labelY = centerY + labelRadius * Math.sin(labelAngle);

    currentAngle = endAngle;

    return {
      name: item.name,
      value: item.value,
      percentage,
      startAngle,
      endAngle,
      largeArc,
      path,
      labelX,
      labelY,
    };
  });
}
