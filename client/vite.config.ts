import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Disable service worker generation - we use manual sw.js for push notifications
      // Only generate manifest.json for PWA metadata
      registerType: 'prompt',
      injectRegister: false, // We register manually in main.tsx
      // Use generateSW strategy but with minimal config - we won't actually use the generated SW
      // This satisfies the plugin's requirements while we use our manual sw.js
      strategies: 'generateSW',
      workbox: {
        // Provide a dummy swDest to satisfy the plugin requirement
        // We won't use this since injectRegister is false and we register manually
        swDest: 'dist/sw-workbox.js',
        // Disable all Workbox features since we handle everything manually
        runtimeCaching: [],
        skipWaiting: false,
        clientsClaim: false,
        // Don't precache anything
        globPatterns: [],
      },
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'android-chrome-192x192.png',
      ],
      manifest: {
        name: 'MeetLite - Video Conferencing',
        short_name: 'MeetLite',
        description:
          'High-quality video conferencing solution for seamless online meetings and collaboration',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any',
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any',
          },
        ],
        shortcuts: [
          {
            name: 'Start Meeting',
            short_name: 'Meet',
            description: 'Start a new video meeting',
            url: '/dashboard',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'My Meetings',
            short_name: 'Meetings',
            description: 'View and manage your meetings',
            url: '/meetings',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
  server: {
    port: 5174,
    // allowedHosts: [
    //   'localhost',
    //   '127.0.0.1',
    //   '686e0379708e.ngrok-free.app', // ngrok frontend tunnel
    // ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
