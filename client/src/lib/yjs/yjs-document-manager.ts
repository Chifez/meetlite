import * as Y from 'yjs';
import { YjsProvider } from './yjs-provider';
import { YjsDocumentConfig } from './types';

/**
 * Document Manager for Yjs
 * Handles lifecycle of Yjs documents across the application
 */
export class YjsDocumentManager {
  private provider: YjsProvider | null;
  private documents: Map<string, Y.Doc>;

  constructor() {
    this.provider = null;
    this.documents = new Map();
  }

  /**
   * Set the provider
   */
  setProvider(provider: YjsProvider): void {
    this.provider = provider;
  }

  /**
   * Get or create a document for code editor
   */
  getCodeDocument(roomId: string): Y.Doc {
    const docId = `code-${roomId}`;
    return this.getOrCreateDocument(docId, 'code');
  }

  /**
   * Get or create a document for workflow node
   */
  getWorkflowNodeDocument(
    roomId: string,
    nodeId: string,
    field: string
  ): Y.Doc {
    const docId = `workflow-${roomId}-${nodeId}-${field}`;
    return this.getOrCreateDocument(docId, 'workflow-node');
  }

  /**
   * Get or create a document
   */
  private getOrCreateDocument(
    docId: string,
    type: YjsDocumentConfig['type']
  ): Y.Doc {
    // Check if document already exists locally
    let doc = this.documents.get(docId);
    if (doc) {
      return doc;
    }

    // If provider exists, use it to create document
    if (this.provider) {
      doc = this.provider.getOrCreateDocument(docId, type);
      this.documents.set(docId, doc);
      return doc;
    }

    // Fallback: create standalone document (no sync)
    console.warn(
      `[DocumentManager] Creating standalone document ${docId} without provider`
    );
    doc = new Y.Doc();
    this.documents.set(docId, doc);
    return doc;
  }

  /**
   * Get Y.Text for code editor
   */
  getCodeText(roomId: string): Y.Text {
    const doc = this.getCodeDocument(roomId);
    return doc.getText('code');
  }

  /**
   * Get Y.Text for workflow node field
   */
  getWorkflowNodeText(roomId: string, nodeId: string, field: string): Y.Text {
    const doc = this.getWorkflowNodeDocument(roomId, nodeId, field);
    return doc.getText(field);
  }

  /**
   * Destroy a document
   */
  destroyDocument(docId: string): void {
    const doc = this.documents.get(docId);
    if (doc) {
      doc.destroy();
      this.documents.delete(docId);
    }

    // Also destroy in provider
    if (this.provider) {
      this.provider.destroyDocument(docId);
    }
  }

  /**
   * Destroy all documents for a room
   */
  destroyRoomDocuments(roomId: string): void {
    const docIdsToDestroy: string[] = [];

    // Find all documents for this room
    this.documents.forEach((_doc, docId) => {
      if (
        docId.startsWith(`code-${roomId}`) ||
        docId.startsWith(`workflow-${roomId}`)
      ) {
        docIdsToDestroy.push(docId);
      }
    });

    // Destroy them
    docIdsToDestroy.forEach((docId) => this.destroyDocument(docId));

    console.log(
      `[DocumentManager] Destroyed ${docIdsToDestroy.length} documents for room ${roomId}`
    );
  }

  /**
   * Destroy all documents
   */
  destroyAll(): void {
    this.documents.forEach((_doc, docId) => {
      this.destroyDocument(docId);
    });

    console.log('[DocumentManager] Destroyed all documents');
  }

  /**
   * Get document count
   */
  getDocumentCount(): number {
    return this.documents.size;
  }

  /**
   * Get all document IDs
   */
  getDocumentIds(): string[] {
    return Array.from(this.documents.keys());
  }
}

// Singleton instance
export const documentManager = new YjsDocumentManager();
