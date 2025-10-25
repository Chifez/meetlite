import * as Y from 'yjs';
import { UserAwareness, CursorPosition, SelectionRange } from './types';

/**
 * Awareness Manager for Yjs
 * Manages cursor presence and user awareness across documents
 */
export class YjsAwarenessManager {
  private awareness: Map<string, Y.Awareness>;

  constructor() {
    this.awareness = new Map();
  }

  /**
   * Register an awareness instance for a document
   */
  register(docId: string, awareness: Y.Awareness): void {
    this.awareness.set(docId, awareness);
  }

  /**
   * Unregister an awareness instance
   */
  unregister(docId: string): void {
    this.awareness.delete(docId);
  }

  /**
   * Update local cursor position
   */
  updateCursor(docId: string, cursor: CursorPosition | null): void {
    const awareness = this.awareness.get(docId);
    if (!awareness) return;

    const currentState = awareness.getLocalState();
    awareness.setLocalState({
      ...currentState,
      cursor,
      lastActivity: Date.now(),
    });
  }

  /**
   * Update local selection
   */
  updateSelection(docId: string, selection: SelectionRange | null): void {
    const awareness = this.awareness.get(docId);
    if (!awareness) return;

    const currentState = awareness.getLocalState();
    awareness.setLocalState({
      ...currentState,
      selection,
      lastActivity: Date.now(),
    });
  }

  /**
   * Update active node (for workflow)
   */
  updateActiveNode(
    docId: string,
    nodeId: string | null,
    fieldName: string | null
  ): void {
    const awareness = this.awareness.get(docId);
    if (!awareness) return;

    const currentState = awareness.getLocalState();
    awareness.setLocalState({
      ...currentState,
      activeNodeId: nodeId,
      activeFieldName: fieldName,
      lastActivity: Date.now(),
    });
  }

  /**
   * Set local user as active
   */
  setActive(docId: string, isActive: boolean): void {
    const awareness = this.awareness.get(docId);
    if (!awareness) return;

    const currentState = awareness.getLocalState();
    awareness.setLocalState({
      ...currentState,
      isActive,
      lastActivity: Date.now(),
    });
  }

  /**
   * Get all remote users
   */
  getRemoteUsers(docId: string): Map<number, UserAwareness> {
    const awareness = this.awareness.get(docId);
    if (!awareness) return new Map();

    const remoteStates = new Map<number, UserAwareness>();
    const states = awareness.getStates();

    states.forEach((state, clientId) => {
      // Skip local client
      if (clientId === awareness.clientID) return;

      remoteStates.set(clientId, state as UserAwareness);
    });

    return remoteStates;
  }

  /**
   * Get active remote users (those currently editing)
   */
  getActiveRemoteUsers(docId: string): UserAwareness[] {
    const remoteUsers = this.getRemoteUsers(docId);
    const activeUsers: UserAwareness[] = [];

    remoteUsers.forEach((user) => {
      if (user.isActive) {
        activeUsers.push(user);
      }
    });

    return activeUsers;
  }

  /**
   * Get remote users editing a specific field
   */
  getRemoteUsersOnField(
    docId: string,
    nodeId: string,
    fieldName: string
  ): UserAwareness[] {
    const remoteUsers = this.getRemoteUsers(docId);
    const users: UserAwareness[] = [];

    remoteUsers.forEach((user) => {
      if (user.activeNodeId === nodeId && user.activeFieldName === fieldName) {
        users.push(user);
      }
    });

    return users;
  }

  /**
   * Get count of active users
   */
  getActiveUserCount(docId: string): number {
    return this.getActiveRemoteUsers(docId).length + 1; // +1 for local user
  }

  /**
   * Subscribe to awareness changes
   */
  subscribe(
    docId: string,
    callback: (changes: {
      added: number[];
      updated: number[];
      removed: number[];
    }) => void
  ): () => void {
    const awareness = this.awareness.get(docId);
    if (!awareness) {
      console.warn(`[AwarenessManager] No awareness for docId: ${docId}`);
      return () => {};
    }

    // Wrap callback to filter out local changes if needed
    const wrappedCallback = (changes: any) => {
      callback(changes);
    };

    awareness.on('change', wrappedCallback);

    // Return unsubscribe function
    return () => {
      awareness.off('change', wrappedCallback);
    };
  }

  /**
   * Clear all awareness states
   */
  clearAll(): void {
    this.awareness.forEach((awareness) => {
      awareness.destroy();
    });
    this.awareness.clear();
  }

  /**
   * Get local state
   */
  getLocalState(docId: string): UserAwareness | null {
    const awareness = this.awareness.get(docId);
    if (!awareness) return null;

    return awareness.getLocalState() as UserAwareness;
  }

  /**
   * Get all states (local + remote)
   */
  getAllStates(docId: string): Map<number, UserAwareness> {
    const awareness = this.awareness.get(docId);
    if (!awareness) return new Map();

    return awareness.getStates() as Map<number, UserAwareness>;
  }
}

// Singleton instance
export const awarenessManager = new YjsAwarenessManager();
