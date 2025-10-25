import * as Y from 'yjs';
import { Socket } from 'socket.io-client';
import { Awareness } from 'y-protocols/awareness';

/**
 * Yjs Document Types
 */
export interface YjsDocumentConfig {
  roomId: string;
  docId: string;
  type: 'code' | 'workflow-node' | 'whiteboard';
}

export interface YjsDocument {
  doc: Y.Doc;
  config: YjsDocumentConfig;
  awareness: Awareness | null;
  synced: boolean;
}

/**
 * Cursor & Awareness Types
 */
export interface CursorPosition {
  index: number; // Character index in document (primary reference)
  timestamp?: number; // Optional timestamp for conflict resolution
}

export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

export interface UserAwareness {
  userId: string;
  userName: string;
  userEmail?: string;
  userColor: string;
  cursor: CursorPosition | null;
  selection: SelectionRange | null;
  // For workflow nodes
  activeNodeId: string | null;
  activeFieldName: string | null;
  // Metadata
  lastActivity: number;
  isActive: boolean;
}

export interface AwarenessState {
  local: UserAwareness;
  remote: Map<number, UserAwareness>; // clientId -> UserAwareness
}

/**
 * Text Delta Types (for diffing)
 */
export type DeltaOperation =
  | { type: 'retain'; length: number }
  | { type: 'insert'; content: string; position: number }
  | { type: 'delete'; length: number; position: number };

export interface TextDiff {
  operations: DeltaOperation[];
  cursorAdjustment: number; // How much to adjust cursor position
}

/**
 * Yjs Provider Types
 */
export interface YjsProviderConfig {
  socket: Socket | null;
  roomId: string;
  userId: string;
  userName: string;
  userEmail?: string;
}

export interface YjsProvider {
  config: YjsProviderConfig;
  documents: Map<string, YjsDocument>;
  awareness: Map<string, Awareness>;
  connected: boolean;

  // Methods
  connect(): void;
  disconnect(): void;
  getOrCreateDocument(docId: string, type: YjsDocumentConfig['type']): Y.Doc;
  destroyDocument(docId: string): void;
  syncDocument(docId: string, update: Uint8Array): void;
  broadcastAwareness(docId: string, state: Partial<UserAwareness>): void;
}

/**
 * Sync Protocol Types
 */
export enum YjsMessageType {
  SYNC_STEP1 = 0, // Request sync
  SYNC_STEP2 = 1, // Send full state
  SYNC_UPDATE = 2, // Send incremental update
  AWARENESS = 3, // Awareness update
  QUERY_AWARENESS = 4, // Request awareness state
}

export interface YjsSyncMessage {
  type: YjsMessageType;
  roomId: string;
  docId: string;
  update?: Uint8Array;
  awareness?: Partial<UserAwareness>;
  timestamp: number;
}

/**
 * Binding Types (for react-simple-code-editor)
 */
export interface CodeEditorBinding {
  yText: Y.Text;
  editor: {
    getValue: () => string;
    setValue: (value: string) => void;
    getCursorPosition: () => CursorPosition;
    setCursorPosition: (position: CursorPosition) => void;
  };
  awareness: Awareness;

  // State
  isUpdating: boolean;
  lastValue: string;

  // Methods
  bind(): void;
  unbind(): void;
  updateFromYjs(event: Y.YTextEvent): void;
  updateFromEditor(newValue: string): void;
}

/**
 * Undo/Redo Types
 */
export interface UndoManagerConfig {
  captureTimeout: number; // Milliseconds before creating new undo step
  trackedOrigins: Set<any>;
}

/**
 * Persistence Types
 */
export interface YjsSnapshot {
  docId: string;
  roomId: string;
  snapshot: Uint8Array;
  version: number;
  timestamp: number;
  createdBy: string;
}

/**
 * Error Types
 */
export class YjsError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'YjsError';
    this.code = code;
  }
}

export enum YjsErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
  SYNC_FAILED = 'SYNC_FAILED',
  AWARENESS_FAILED = 'AWARENESS_FAILED',
  BINDING_ERROR = 'BINDING_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

/**
 * Event Types
 */
export interface YjsEvents {
  connected: () => void;
  disconnected: () => void;
  synced: (docId: string) => void;
  update: (docId: string, update: Uint8Array) => void;
  'awareness-change': (
    docId: string,
    changes: { added: number[]; updated: number[]; removed: number[] }
  ) => void;
  error: (error: YjsError) => void;
}

/**
 * Utility Types
 */
export type YjsEventListener<T extends keyof YjsEvents> = YjsEvents[T];

export interface YjsStats {
  documentsCount: number;
  activeUsers: number;
  totalOperations: number;
  averageLatency: number;
}
