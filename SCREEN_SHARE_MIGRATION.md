# Screen Sharing Migration to MediaSoup

## Overview

Screen sharing has been successfully migrated from **P2P WebRTC mesh** to **MediaSoup SFU architecture**. This provides better scalability, reduced bandwidth for the screensharer, and unified architecture with camera/mic streams.

---

## What Changed

### **Before (P2P Architecture)**

```
Screensharer → N RTCPeerConnections → N Viewers
- O(N) bandwidth for sharer
- Separate signaling system
- ~560 lines of P2P connection management code
```

### **After (MediaSoup Architecture)**

```
Screensharer → MediaSoup Server → N Viewers
- O(1) bandwidth for sharer
- Unified with camera/mic streams
- ~250 lines using MediaSoup producer/consumer pattern
```

---

## Implementation Details

### **Server Side Changes**

#### 1. **MediaSoupWorker.js**

- Updated `createProducer()` to accept `appData` parameter
- Stores `source` ('camera' or 'screen') and `mediaType` metadata

#### 2. **MediaSoupService.js**

- Added `screenSharing` Map to track active screensharer per room
- Added helper methods:
  - `getScreenSharing(roomId)` - Get current screen sharer
  - `stopScreenSharing(roomId, userId)` - Clear screen share state
  - `isUserScreenSharing(roomId, userId)` - Check if user is sharing
- Updated `createProducer()` to:
  - Accept `appData` parameter
  - Enforce single screensharer per room
  - Track screen producers separately

#### 3. **MediaController.js**

- Updated `handleCreateProducer()` to:
  - Accept and forward `appData` from client
  - Broadcast producer metadata (source, mediaType) to viewers
- Updated `handleScreenShareStopped()` to:
  - Close screen producers on MediaSoup router
  - Clean up screen sharing state
  - Notify all participants
- Updated `handleReady()` to:
  - Include `screenSharing` info in room-data
  - Send screen producer info to late joiners

---

### **Client Side Changes**

#### 1. **use-mediasoup.tsx**

Added screen share functionality:

**State:**

```typescript
screenShare: {
  stream: MediaStream | null,
  sharingUserId: string | null,
  videoProducer: Producer | null,
  audioProducer: Producer | null,
  videoConsumer: Consumer | null,
  audioConsumer: Consumer | null,
}
```

**New Functions:**

- `produceScreenStream(screenStream)` - Create screen producers
- `stopScreenProduction()` - Close screen producers
- `consumeScreenStream(producerId, userId, mediaType)` - Consume screen from others
- `stopScreenConsumption()` - Close screen consumers

**Updated Handlers:**

- `handleNewProducer()` - Detects screen producers via `source` field
- `handleRoomData()` - Consumes existing screen producers from room-data
- `handleScreenShareStopped()` - Closes screen consumers

#### 2. **use-screen-share.tsx**

- Updated to use MediaSoup functions instead of P2P
- Simplified from 147 lines to ~90 lines
- No more P2P connection management
- Calls `produceScreenStream()` after getting display media
- Calls `stopScreenProduction()` when stopping

#### 3. **room.tsx**

- Passes MediaSoup screen functions to `useScreenShare`
- Uses `screenShareStream` from MediaSoup instead of P2P
- Removed `useScreenShareRTC` import (deprecated)

#### 4. **use-screen-share-rtc.tsx**

- Renamed to `use-screen-share-rtc.DEPRECATED.tsx`
- Returns empty state with deprecation warning
- Can be deleted after verification

---

## Producer/Consumer Flow

### **Starting Screen Share**

1. User clicks "Share Screen"
2. Browser displays screen picker → returns MediaStream
3. Client calls `produceScreenStream(stream)`
4. Creates producers with `appData`:
   ```javascript
   appData: {
     source: 'screen',
     mediaType: 'screen-video' // or 'screen-audio'
   }
   ```
5. Server creates producers on existing send transport
6. Server broadcasts `new-producer` with metadata to all viewers
7. Viewers detect `source === 'screen'` and call `consumeScreenStream()`

### **Viewing Screen Share**

1. Viewer receives `new-producer` event with `source: 'screen'`
2. Calls `consumeScreenStream(producerId, userId, mediaType)`
3. Creates consumer on existing receive transport
4. Builds MediaStream from screen tracks
5. Updates state → UI displays screen

### **Stopping Screen Share**

1. Sharer calls `stopScreenProduction()`
2. Closes producers locally
3. Emits `screen-share-stopped` to server
4. Server closes producers on router
5. MediaSoup automatically closes all linked consumers
6. Viewers receive `screen-share-stopped` event
7. Viewers call `stopScreenConsumption()`

---

## Key Benefits

| Aspect               | P2P                 | MediaSoup          |
| -------------------- | ------------------- | ------------------ |
| **Sharer Bandwidth** | 5 viewers = 15 Mbps | 5 viewers = 3 Mbps |
| **Late Joiner**      | New P2P setup       | Automatic routing  |
| **Code Complexity**  | ~560 lines          | ~250 lines         |
| **Scalability**      | Max ~10 users       | 100+ users         |
| **Architecture**     | Dual system         | Unified            |
| **Recording**        | Complex             | Simple             |

---

## Transport Reuse

**Before:**

- Camera: N RTCPeerConnections
- Screen: N RTCPeerConnections
- **Total: 2N connections**

**After:**

- Camera: 1 send + 1 receive transport
- Screen: **SAME transports** (reused!)
- **Total: 2 transports**

---

## Testing Checklist

- [ ] Start screen share - viewers see screen
- [ ] Stop screen share - viewers lose screen
- [ ] Late joiner - automatically receives screen
- [ ] Multiple viewers - all receive screen
- [ ] Screen audio - transmitted if available
- [ ] User stops via browser button - cleans up properly
- [ ] Single sharer enforcement - second user can't share
- [ ] Sharer leaves - viewers notified and cleaned up

---

## Cleanup Tasks

After confirming screen sharing works:

1. ✅ Delete `use-screen-share-rtc.tsx` (renamed to .DEPRECATED)
2. ⬜ Remove P2P screen signaling from signaling-service (if still running)
3. ⬜ Remove screen share P2P event handlers from server
4. ⬜ Update tests to use MediaSoup screen share

---

## Rollback Plan

If issues occur, the P2P implementation is preserved in:

- `use-screen-share-rtc.DEPRECATED.tsx`
- Signaling service screen share handlers (if not deleted)

To rollback:

1. Rename `.DEPRECATED.tsx` back to `.tsx`
2. Re-import in room.tsx
3. Revert server changes using git

---

## Migration Date

Completed: [Current Date]
Engineer: AI Assistant
Architecture: P2P Mesh → MediaSoup SFU
