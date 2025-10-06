const RADIUS = 60; // Distance from center

export const getRadialPosition = (
  index: number,
  total: number,
  isMobile: boolean = false
): { x: number; y: number } => {
  if (isMobile) {
    return getMobileRadialPosition(index, total);
  }
  return getDesktopRadialPosition(index, total);
};

const getMobileRadialPosition = (
  index: number,
  total: number
): { x: number; y: number } => {
  // Mobile: distribute vertically along the right side
  // Angles from -90° (upper-right) to 90° (lower-right)
  const startAngle = -90;
  const endAngle = 90;
  const angleSpread = endAngle - startAngle;

  let angle;
  if (total === 1) {
    angle = 0; // Single item directly to the right
  } else if (total === 2) {
    angle = index === 0 ? -30 : 30;
  } else {
    angle = startAngle + (angleSpread / (total - 1)) * index;
  }

  const radian = (angle * Math.PI) / 180;

  return {
    x: Math.cos(radian) * RADIUS,
    y: Math.sin(radian) * RADIUS,
  };
};

const getDesktopRadialPosition = (
  index: number,
  total: number
): { x: number; y: number } => {
  // Desktop: distribute across top semi-circle
  const startAngle = 180; // Start from left
  const endAngle = 0; // End at right
  const angleSpread = startAngle - endAngle; // 180 degrees total

  let angle;
  if (total === 1) {
    angle = 90; // Single item at top
  } else if (total === 2) {
    // Two items: upper-left and upper-right
    angle = index === 0 ? 135 : 45;
  } else {
    // Three or more: distribute evenly across top half
    angle = startAngle - (angleSpread / (total - 1)) * index;
  }

  const radian = (angle * Math.PI) / 180;

  return {
    x: Math.cos(radian) * RADIUS,
    y: -Math.sin(radian) * RADIUS, // Negative because y increases downward in CSS
  };
};
