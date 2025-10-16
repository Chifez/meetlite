/**
 * DEPRECATED: This file is no longer used
 *
 * Screen sharing now uses MediaSoup producers/consumers instead of P2P WebRTC
 * See use-mediasoup.tsx for the new implementation
 *
 * Migration completed: [Date]
 * - Screen share now uses MediaSoup SFU architecture
 * - Better scalability (O(1) bandwidth for sharer vs O(N))
 * - Simpler code (no manual P2P connection management)
 * - Unified with camera/mic streams
 *
 * This file is kept for reference only and can be deleted after verification
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

// Configuration for WebRTC
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Free TURN servers for testing - replace with your own for production
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

// Helper to create a unique connection ID for screen sharing
const createConnectionId = (localId: string, remoteId: string) => {
  return `screen_${[localId, remoteId].sort().join('_')}`;
};

interface ScreenPeerConnection {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  isLoading?: boolean;
}

export const useScreenShareRTC = (
  socket: Socket | null,
  screenStream: MediaStream | null
) => {
  const [screenPeers, setScreenPeers] = useState<
    Map<string, ScreenPeerConnection>
  >(new Map());
  const peersRef = useRef<Map<string, ScreenPeerConnection>>(new Map());
  const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );

  // Track pending initiation requests
  const pendingInitiations = useRef<
    Array<{ userId: string; isInitiator: boolean }>
  >([]);

  // This hook is now deprecated and returns empty state
  console.warn(
    '⚠️ useScreenShareRTC is DEPRECATED. Screen sharing now uses MediaSoup.'
  );

  return { screenPeers: new Map() };
};
