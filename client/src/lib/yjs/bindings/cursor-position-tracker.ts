import { CursorPosition, SelectionRange } from '../types';

/**
 * Cursor Position Tracker
 * Utilities for tracking and converting cursor positions in text editors
 */

/**
 * Convert index to line/column position
 */
export function indexToPosition(text: string, index: number): CursorPosition {
  const lines = text.substring(0, index).split('\n');
  const line = lines.length - 1;
  const column = lines[lines.length - 1].length;

  return { line, column, index };
}

/**
 * Convert line/column position to index
 */
export function positionToIndex(
  text: string,
  line: number,
  column: number
): number {
  const lines = text.split('\n');

  let index = 0;
  for (let i = 0; i < line && i < lines.length; i++) {
    index += lines[i].length + 1; // +1 for newline character
  }

  // Add column offset (ensure we don't go past line length)
  if (line < lines.length) {
    index += Math.min(column, lines[line].length);
  }

  return index;
}

/**
 * Get selection range from textarea element
 */
export function getSelectionFromTextarea(
  element: HTMLTextAreaElement
): SelectionRange | null {
  const start = element.selectionStart;
  const end = element.selectionEnd;
  const text = element.value;

  if (start === null || end === null) return null;

  return {
    start: indexToPosition(text, start),
    end: indexToPosition(text, end),
  };
}

/**
 * Set selection on textarea element
 */
export function setTextareaSelection(
  element: HTMLTextAreaElement,
  selection: SelectionRange
): void {
  const text = element.value;
  const startIndex = positionToIndex(
    text,
    selection.start.line,
    selection.start.column
  );
  const endIndex = positionToIndex(
    text,
    selection.end.line,
    selection.end.column
  );

  element.setSelectionRange(startIndex, endIndex);
}

/**
 * Get cursor position from textarea element
 */
export function getCursorFromTextarea(
  element: HTMLTextAreaElement
): CursorPosition | null {
  const position = element.selectionStart;
  const text = element.value;

  if (position === null) return null;

  return indexToPosition(text, position);
}

/**
 * Set cursor position on textarea element
 */
export function setTextareaCursor(
  element: HTMLTextAreaElement,
  cursor: CursorPosition
): void {
  const text = element.value;
  const index = positionToIndex(text, cursor.line, cursor.column);

  element.setSelectionRange(index, index);
}

/**
 * Clamp position to text bounds
 */
export function clampPosition(
  text: string,
  position: CursorPosition
): CursorPosition {
  const lines = text.split('\n');

  // Clamp line
  const line = Math.max(0, Math.min(position.line, lines.length - 1));

  // Clamp column
  const maxColumn = lines[line]?.length || 0;
  const column = Math.max(0, Math.min(position.column, maxColumn));

  // Recalculate index
  const index = positionToIndex(text, line, column);

  return { line, column, index };
}

/**
 * Check if selection is valid
 */
export function isValidSelection(
  text: string,
  selection: SelectionRange
): boolean {
  const lines = text.split('\n');

  // Check start position
  if (
    selection.start.line < 0 ||
    selection.start.line >= lines.length ||
    selection.start.column < 0 ||
    selection.start.column > lines[selection.start.line].length
  ) {
    return false;
  }

  // Check end position
  if (
    selection.end.line < 0 ||
    selection.end.line >= lines.length ||
    selection.end.column < 0 ||
    selection.end.column > lines[selection.end.line].length
  ) {
    return false;
  }

  // Check start comes before end
  if (selection.start.line > selection.end.line) {
    return false;
  }

  if (
    selection.start.line === selection.end.line &&
    selection.start.column > selection.end.column
  ) {
    return false;
  }

  return true;
}

/**
 * Get text in selection range
 */
export function getTextInSelection(
  text: string,
  selection: SelectionRange
): string {
  const startIndex = positionToIndex(
    text,
    selection.start.line,
    selection.start.column
  );
  const endIndex = positionToIndex(
    text,
    selection.end.line,
    selection.end.column
  );

  return text.substring(startIndex, endIndex);
}
