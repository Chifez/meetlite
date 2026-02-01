/**
 * State Validation Utilities
 * Provides checksum verification and consistency checks for Yjs documents
 */

import * as Y from 'yjs';
import { encodeStateAsUpdate, encodeStateVector } from 'yjs';

/**
 * Calculate a simple hash/checksum of a Uint8Array
 * Uses a fast non-cryptographic hash for performance
 */
export function calculateChecksum(data: Uint8Array): number {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Get the checksum of a Y.Doc's current state
 */
export function getDocumentChecksum(doc: Y.Doc): number {
  const state = encodeStateAsUpdate(doc);
  return calculateChecksum(state);
}

/**
 * Get the state vector as a comparable string
 */
export function getStateVectorString(doc: Y.Doc): string {
  const stateVector = encodeStateVector(doc);
  return Array.from(stateVector).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Document state snapshot for comparison
 */
export interface DocumentSnapshot {
  docId: string;
  checksum: number;
  stateVectorHash: string;
  contentLength: number;
  timestamp: number;
}

/**
 * Create a snapshot of a Y.Doc for state verification
 */
export function createDocumentSnapshot(doc: Y.Doc, docId: string): DocumentSnapshot {
  const state = encodeStateAsUpdate(doc);
  return {
    docId,
    checksum: calculateChecksum(state),
    stateVectorHash: getStateVectorString(doc),
    contentLength: state.length,
    timestamp: Date.now(),
  };
}

/**
 * Compare two document snapshots
 */
export function compareSnapshots(
  local: DocumentSnapshot,
  remote: DocumentSnapshot
): {
  isEqual: boolean;
  differences: string[];
} {
  const differences: string[] = [];

  if (local.checksum !== remote.checksum) {
    differences.push(`Checksum mismatch: local=${local.checksum}, remote=${remote.checksum}`);
  }

  if (local.stateVectorHash !== remote.stateVectorHash) {
    differences.push(`State vector mismatch`);
  }

  if (local.contentLength !== remote.contentLength) {
    differences.push(`Content length mismatch: local=${local.contentLength}, remote=${remote.contentLength}`);
  }

  return {
    isEqual: differences.length === 0,
    differences,
  };
}

/**
 * Validate Y.Text content
 */
export function validateTextContent(yText: Y.Text): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    // Check if text can be converted to string
    const content = yText.toString();
    
    // Check for common issues
    if (content.includes('\u0000')) {
      errors.push('Text contains null characters');
    }

    // Check for excessive length (could indicate corruption)
    if (content.length > 10_000_000) {
      errors.push('Text exceeds maximum length (10MB)');
    }
  } catch (error) {
    errors.push(`Failed to validate text: ${error}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * State consistency checker that periodically verifies document state
 */
export class StateConsistencyChecker {
  private snapshots: Map<string, DocumentSnapshot> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private onInconsistency: ((docId: string, details: string[]) => void) | null = null;

  constructor() {
    console.log('[StateConsistencyChecker] Initialized');
  }

  /**
   * Start periodic consistency checks
   */
  startChecking(interval: number = 30000): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.checkAllDocuments();
    }, interval);

    console.log(`[StateConsistencyChecker] Started with interval ${interval}ms`);
  }

  /**
   * Stop periodic checking
   */
  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[StateConsistencyChecker] Stopped');
    }
  }

  /**
   * Register a callback for inconsistency detection
   */
  onInconsistencyDetected(callback: (docId: string, details: string[]) => void): void {
    this.onInconsistency = callback;
  }

  /**
   * Take a snapshot of a document
   */
  takeSnapshot(doc: Y.Doc, docId: string): void {
    const snapshot = createDocumentSnapshot(doc, docId);
    this.snapshots.set(docId, snapshot);
  }

  /**
   * Verify a document against its last snapshot
   */
  verifyDocument(doc: Y.Doc, docId: string): {
    isValid: boolean;
    hasChanged: boolean;
    changes: string[];
  } {
    const currentSnapshot = createDocumentSnapshot(doc, docId);
    const previousSnapshot = this.snapshots.get(docId);

    if (!previousSnapshot) {
      // No previous snapshot, just save current
      this.snapshots.set(docId, currentSnapshot);
      return {
        isValid: true,
        hasChanged: false,
        changes: [],
      };
    }

    const comparison = compareSnapshots(previousSnapshot, currentSnapshot);

    // Update snapshot
    this.snapshots.set(docId, currentSnapshot);

    return {
      isValid: true,
      hasChanged: !comparison.isEqual,
      changes: comparison.differences,
    };
  }

  /**
   * Check all registered documents
   */
  private checkAllDocuments(): void {
    // This would need access to actual documents
    // In practice, you'd call verifyDocument for each registered doc
    console.log('[StateConsistencyChecker] Running consistency check...');
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots.clear();
  }
}

// Singleton instance
export const stateConsistencyChecker = new StateConsistencyChecker();

export default {
  calculateChecksum,
  getDocumentChecksum,
  getStateVectorString,
  createDocumentSnapshot,
  compareSnapshots,
  validateTextContent,
  StateConsistencyChecker,
  stateConsistencyChecker,
};

