/**
 * Cursor position utilities for code editor
 */

/**
 * Convert absolute character index to line and column
 */
export function indexToLineColumn(
  text: string,
  index: number
): { line: number; column: number } {
  if (index < 0 || index > text.length) {
    return { line: 0, column: 0 };
  }

  const lines = text.substring(0, index).split('\n');
  const line = lines.length - 1;
  const column = lines[lines.length - 1].length;

  return { line, column };
}

/**
 * Convert line and column to absolute character index
 */
export function lineColumnToIndex(
  text: string,
  line: number,
  column: number
): number {
  const lines = text.split('\n');

  if (line < 0 || line >= lines.length) {
    return 0;
  }

  let index = 0;

  // Add all previous lines (including their \n characters)
  for (let i = 0; i < line; i++) {
    index += lines[i].length + 1; // +1 for the newline character
  }

  // Add column position on current line
  const columnClamped = Math.min(column, lines[line].length);
  index += columnClamped;

  return index;
}

/**
 * Calculate pixel position from line and column
 */
export function calculateCursorPosition(
  line: number,
  column: number,
  lineHeight: number,
  charWidth: number,
  scrollTop: number = 0,
  scrollLeft: number = 0
): { x: number; y: number } {
  const x = column * charWidth - scrollLeft + 10; // +10 for padding
  const y = line * lineHeight - scrollTop + 10; // +10 for padding

  return { x, y };
}

/**
 * Measure character width and line height from a textarea
 */
export function measureEditorMetrics(textarea: HTMLTextAreaElement): {
  charWidth: number;
  lineHeight: number;
} {
  const computedStyle = window.getComputedStyle(textarea);
  const fontSize = parseFloat(computedStyle.fontSize);
  const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.5;

  // For monospace fonts, char width is roughly 0.6 * fontSize
  // We can measure more precisely if needed
  const charWidth = fontSize * 0.6;

  return { charWidth, lineHeight };
}

/**
 * Throttle function to limit update frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCall = 0;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func.apply(this, args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay - timeSinceLastCall);
    }
  };
}
