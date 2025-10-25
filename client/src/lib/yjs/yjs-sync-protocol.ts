import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { YjsMessageType, YjsSyncMessage } from './types';

/**
 * Yjs Sync Protocol utilities
 * Handles binary encoding/decoding for Yjs sync messages
 */

/**
 * Encode a sync message to binary format
 */
export function encodeSyncMessage(message: YjsSyncMessage): Uint8Array {
  const encoder = encoding.createEncoder();

  // Write message type
  encoding.writeVarUint(encoder, message.type);

  // Write update if present
  if (message.update) {
    encoding.writeVarUint8Array(encoder, message.update);
  }

  return encoding.toUint8Array(encoder);
}

/**
 * Decode a sync message from binary format
 */
export function decodeSyncMessage(
  data: Uint8Array,
  roomId: string,
  docId: string
): YjsSyncMessage {
  const decoder = decoding.createDecoder(data);

  // Read message type
  const type = decoding.readVarUint(decoder) as YjsMessageType;

  // Read update if present
  let update: Uint8Array | undefined;
  if (decoding.hasContent(decoder)) {
    update = decoding.readVarUint8Array(decoder);
  }

  return {
    type,
    roomId,
    docId,
    update,
    timestamp: Date.now(),
  };
}

/**
 * Create a sync step 1 message (request sync)
 */
export function createSyncStep1Message(
  doc: Y.Doc,
  roomId: string,
  docId: string
): YjsSyncMessage {
  const encoder = encoding.createEncoder();

  // Encode state vector
  const stateVector = Y.encodeStateVector(doc);
  encoding.writeVarUint8Array(encoder, stateVector);

  return {
    type: YjsMessageType.SYNC_STEP1,
    roomId,
    docId,
    update: encoding.toUint8Array(encoder),
    timestamp: Date.now(),
  };
}

/**
 * Create a sync step 2 message (send full state)
 */
export function createSyncStep2Message(
  doc: Y.Doc,
  stateVector: Uint8Array,
  roomId: string,
  docId: string
): YjsSyncMessage {
  const encoder = encoding.createEncoder();

  // Encode state as update based on state vector
  const update = Y.encodeStateAsUpdate(doc, stateVector);
  encoding.writeVarUint8Array(encoder, update);

  return {
    type: YjsMessageType.SYNC_STEP2,
    roomId,
    docId,
    update: encoding.toUint8Array(encoder),
    timestamp: Date.now(),
  };
}

/**
 * Create an update message (incremental change)
 */
export function createUpdateMessage(
  update: Uint8Array,
  roomId: string,
  docId: string
): YjsSyncMessage {
  return {
    type: YjsMessageType.SYNC_UPDATE,
    roomId,
    docId,
    update,
    timestamp: Date.now(),
  };
}

/**
 * Create an awareness message
 */
export function createAwarenessMessage(
  update: Uint8Array,
  roomId: string,
  docId: string
): YjsSyncMessage {
  return {
    type: YjsMessageType.AWARENESS,
    roomId,
    docId,
    update,
    timestamp: Date.now(),
  };
}

/**
 * Merge multiple updates into a single update
 */
export function mergeUpdates(updates: Uint8Array[]): Uint8Array {
  return Y.mergeUpdates(updates);
}

/**
 * Diff two documents and get the update needed
 */
export function diffDocuments(sourceDoc: Y.Doc, targetDoc: Y.Doc): Uint8Array {
  const sourceStateVector = Y.encodeStateVector(sourceDoc);
  const update = Y.encodeStateAsUpdate(targetDoc, sourceStateVector);
  return update;
}

/**
 * Convert Uint8Array to Base64 (for JSON transport if needed)
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}

/**
 * Convert Base64 to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
}
