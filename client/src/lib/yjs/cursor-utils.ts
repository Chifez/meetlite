/**
 * Cursor position utilities for code editor
 * Range API-based implementation for pixel-perfect cursor positioning
 */

/**
 * Get pixel position of a character index using Range API
 * This provides pixel-perfect accuracy by measuring actual DOM elements
 * O(nodes) complexity where nodes ≈ lines + syntax highlighting spans
 */
export function getCursorPixelPositionFromIndex(
  editorElement: HTMLElement,
  characterIndex: number,
  scrollTop: number = 0,
  scrollLeft: number = 0
): { x: number; y: number } | null {
  try {
    // Find the pre element (syntax-highlighted content)
    const preElement = editorElement.querySelector('pre');
    if (!preElement) {
      console.warn('[CursorUtils] Pre element not found');
      return null;
    }

    // Get the computed padding from the pre element
    const computedStyle = window.getComputedStyle(preElement);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;

    // Walk the DOM tree to find the text node at the character index
    let currentIndex = 0;
    let targetNode: Text | null = null;
    let offsetInNode = 0;

    // Create a tree walker to traverse all text nodes
    const walker = document.createTreeWalker(
      preElement,
      NodeFilter.SHOW_TEXT,
      null
    );

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;

      // Skip text nodes that are inside line number spans
      const parentElement = textNode.parentElement;
      if (
        parentElement &&
        parentElement.classList.contains('editorLineNumber')
      ) {
        continue; // Skip line number text nodes
      }

      const textContent = textNode.textContent || '';
      const length = textContent.length;

      if (currentIndex + length >= characterIndex) {
        targetNode = textNode;
        offsetInNode = characterIndex - currentIndex;
        break;
      }
      currentIndex += length;
    }

    // If we didn't find the node, use the last node
    if (!targetNode) {
      // Position at the end of the document
      const lastTextNode = getLastTextNode(preElement);
      if (lastTextNode) {
        targetNode = lastTextNode;
        offsetInNode = lastTextNode.textContent?.length || 0;
      } else {
        // No text nodes at all, position at start (with padding offset)
        return { x: paddingLeft, y: paddingTop };
      }
    }

    // Create a range at the cursor position
    const range = document.createRange();
    range.setStart(targetNode, offsetInNode);
    range.setEnd(targetNode, offsetInNode);

    // Get the bounding box of the range
    const rect = range.getBoundingClientRect();
    const preRect = preElement.getBoundingClientRect();

    // Calculate position relative to the editor, accounting for scroll
    // The Range API gives us the position relative to the pre element's content box
    // We need to add the padding offset since cursors should align with the actual text
    const x = rect.left - preRect.left + scrollLeft;
    const y = rect.top - preRect.top + scrollTop;

    return { x, y };
  } catch (error) {
    console.error('[CursorUtils] Error calculating cursor position:', error);
    return null;
  }
}

/**
 * Helper function to get the last text node in an element
 * Skips line number text nodes
 */
function getLastTextNode(element: HTMLElement): Text | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

  let lastNode: Text | null = null;
  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;

    // Skip text nodes that are inside line number spans
    const parentElement = textNode.parentElement;
    if (parentElement && parentElement.classList.contains('editorLineNumber')) {
      continue;
    }

    lastNode = textNode;
  }

  return lastNode;
}

/**
 * Get scroll position of the editor
 */
export function getEditorScrollPosition(editorElement: HTMLElement): {
  scrollTop: number;
  scrollLeft: number;
} {
  return {
    scrollTop: editorElement.scrollTop || 0,
    scrollLeft: editorElement.scrollLeft || 0,
  };
}

/**
 * Throttle function to limit update frequency
 * Industry standard throttling implementation
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

/**
 * Debounce function to limit update frequency
 * Alternative to throttle for different use cases
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// ==============================================================================
// DEPRECATED FUNCTIONS - Kept for backward compatibility
// These will be removed in a future version
// ==============================================================================

/**
 * @deprecated Use getCursorPixelPositionFromIndex instead
 * Convert absolute character index to line and column
 */
export function indexToLineColumn(
  text: string,
  index: number
): { line: number; column: number } {
  console.warn('[CursorUtils] indexToLineColumn is deprecated');
  if (index < 0 || index > text.length) {
    return { line: 0, column: 0 };
  }

  const lines = text.substring(0, index).split('\n');
  const line = lines.length - 1;
  const column = lines[lines.length - 1].length;

  return { line, column };
}

/**
 * @deprecated Use getCursorPixelPositionFromIndex instead
 * Convert line and column to absolute character index
 */
export function lineColumnToIndex(
  text: string,
  line: number,
  column: number
): number {
  console.warn('[CursorUtils] lineColumnToIndex is deprecated');
  const lines = text.split('\n');

  if (line < 0 || line >= lines.length) {
    return 0;
  }

  let index = 0;
  for (let i = 0; i < line; i++) {
    index += lines[i].length + 1;
  }

  const columnClamped = Math.min(column, lines[line].length);
  index += columnClamped;

  return index;
}

/**
 * @deprecated Use getCursorPixelPositionFromIndex instead
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
  console.warn('[CursorUtils] calculateCursorPosition is deprecated');
  const lineNumberAreaWidth = 60;
  const editorPadding = 10;

  const x =
    column * charWidth - scrollLeft + lineNumberAreaWidth + editorPadding;
  const y = line * lineHeight - scrollTop + editorPadding;

  return { x, y };
}

/**
 * @deprecated No longer needed with Range API approach
 * Measure character width and line height from a textarea
 */
export function measureEditorMetrics(textarea: HTMLTextAreaElement): {
  charWidth: number;
  lineHeight: number;
} {
  console.warn('[CursorUtils] measureEditorMetrics is deprecated');
  const computedStyle = window.getComputedStyle(textarea);
  const fontSize = parseFloat(computedStyle.fontSize);
  const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.5;

  const measureElement = document.createElement('span');
  measureElement.style.font = computedStyle.font;
  measureElement.style.visibility = 'hidden';
  measureElement.style.position = 'absolute';
  measureElement.style.whiteSpace = 'pre';
  measureElement.textContent = 'M';

  document.body.appendChild(measureElement);
  const charWidth = measureElement.getBoundingClientRect().width;
  document.body.removeChild(measureElement);

  return { charWidth, lineHeight };
}
