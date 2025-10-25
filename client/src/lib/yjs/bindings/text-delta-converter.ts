import * as Y from 'yjs';
import diff from 'fast-diff';
import { DeltaOperation } from '../types';

// Diff operation constants
const DIFF_DELETE = -1;
const DIFF_INSERT = 1;
const DIFF_EQUAL = 0;

/**
 * Text Delta Converter
 * Converts between Y.Text operations and string diffs
 */

/**
 * Apply text operations from string diff to Y.Text
 */
export function applyStringDiff(
  yText: Y.Text,
  oldValue: string,
  newValue: string
): void {
  if (oldValue === newValue) return;

  // Calculate diff
  const diffs = diff(oldValue, newValue);

  let index = 0;

  diffs.forEach(([operation, text]) => {
    if (operation === DIFF_EQUAL) {
      // No change, just advance index
      index += text.length;
    } else if (operation === DIFF_DELETE) {
      // Delete text
      yText.delete(index, text.length);
      // Don't advance index since we deleted
    } else if (operation === DIFF_INSERT) {
      // Insert text
      yText.insert(index, text);
      index += text.length;
    }
  });
}

/**
 * Convert Y.Text event to delta operations
 */
export function yTextEventToDelta(event: Y.YTextEvent): DeltaOperation[] {
  const operations: DeltaOperation[] = [];

  event.delta.forEach((delta: any) => {
    if (delta.retain) {
      operations.push({
        type: 'retain',
        length: delta.retain,
      });
    }

    if (delta.insert) {
      const insertText = typeof delta.insert === 'string' ? delta.insert : '';
      operations.push({
        type: 'insert',
        content: insertText,
        position: 0, // Will be calculated based on previous retains
      });
    }

    if (delta.delete) {
      operations.push({
        type: 'delete',
        length: delta.delete,
        position: 0, // Will be calculated based on previous retains
      });
    }
  });

  return operations;
}

/**
 * Calculate cursor adjustment after Y.Text change
 */
export function calculateCursorAdjustment(
  cursorPosition: number,
  event: Y.YTextEvent
): number {
  let adjustment = 0;
  let position = 0;

  event.delta.forEach((delta: any) => {
    if (delta.retain) {
      position += delta.retain;
    }

    if (delta.insert) {
      const insertLength =
        typeof delta.insert === 'string' ? delta.insert.length : 1;
      if (position <= cursorPosition) {
        adjustment += insertLength;
      }
      position += insertLength;
    }

    if (delta.delete) {
      if (position < cursorPosition) {
        const deleteInRange = Math.min(delta.delete, cursorPosition - position);
        adjustment -= deleteInRange;
      }
    }
  });

  return adjustment;
}

/**
 * Get selection range after text change
 */
export function adjustSelection(
  start: number,
  end: number,
  event: Y.YTextEvent
): { start: number; end: number } {
  return {
    start: Math.max(0, start + calculateCursorAdjustment(start, event)),
    end: Math.max(0, end + calculateCursorAdjustment(end, event)),
  };
}
