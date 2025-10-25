import { TLAssetStore, uniqueId } from '@tldraw/tldraw';
import { env } from '@/config/env';

// Asset store configuration for handling uploads
export const multiplayerAssets: TLAssetStore = {
  // Upload assets through API Gateway
  async upload(_asset, file) {
    const id = uniqueId();
    const objectName = `${id}-${file.name}`;

    // Upload directly to MediaSoup service to avoid proxy CORS issues
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `http://localhost:3003/uploads/${encodeURIComponent(objectName)}`,
      {
        method: 'PUT',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to upload asset: ${response.statusText}`);
    }

    const data = await response.json();
    return { src: data.url };
  },

  // Resolve asset URLs
  resolve(asset) {
    return asset.props.src;
  },
};

// Helper to get sync URI for a room
export const getSyncUrl = (roomId: string) => {
  // Use API Gateway for WebSocket connections to MediaSoup service
  // The API Gateway now routes /connect to MediaSoup service for Tldraw
  const baseUrl = env.API_GATEWAY_URL.replace('http', 'ws').replace(
    'https',
    'wss'
  );
  return `${baseUrl}/connect/${roomId}`;
};
