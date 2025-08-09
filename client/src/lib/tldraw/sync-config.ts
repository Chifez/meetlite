import { TLAssetStore, uniqueId } from '@tldraw/tldraw';
import { env } from '@/config/env';

// Asset store configuration for handling uploads
export const multiplayerAssets: TLAssetStore = {
  // Upload assets through our existing infrastructure
  async upload(_asset, file) {
    const id = uniqueId();
    const objectName = `${id}-${file.name}`;

    // We can adapt this to use our existing upload endpoints
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${env.SIGNALING_SERVER_URL}/uploads/${encodeURIComponent(objectName)}`,
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
  // Convert HTTP URL to WebSocket URL and use the correct path format
  const baseUrl = env.SIGNALING_SERVER_URL.replace('http', 'ws').replace(
    'https',
    'wss'
  );
  return `${baseUrl}/connect/${roomId}`;
};
