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
        name: 'MeetLite - Collaborative Video Conferencing for modern teams',
        short_name: 'MeetLite',
        description:
          'MeetLite is a modern, enterprise-grade video conferencing platform featuring HD video calls, smart scheduling, real-time collaboration tools, AI-powered meeting insights, and third-party calendar integrations. Organizations can create multiple organizations and teams with granular access control. Track meeting assets including audio recordings and transcripts at both organization and team levels. Join meetings in seconds with our optimized WebRTC infrastructure.',
        theme_color: '#7c3aed',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'en-US',
        dir: 'ltr',
        categories: [
          'business',
          'productivity',
          'communication',
          'video',
          'meetings',
          'collaboration',
        ],
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
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Home',
            short_name: 'Home',
            description: 'MeetLite landing page',
            url: '/',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Pricing',
            short_name: 'Pricing',
            description: 'View pricing plans',
            url: '/#pricing',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Login',
            short_name: 'Login',
            description: 'Sign in to your account',
            url: '/login',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Register',
            short_name: 'Register',
            description: 'Create a new account',
            url: '/signup',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'Access your dashboard',
            url: '/dashboard',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Schedule Meeting',
            short_name: 'Schedule',
            description: 'Schedule a new meeting',
            url: '/dashboard?modal=schedule',
            icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
          },
        ],
        screenshots: [
          {
            src: '/og-image.png',
            sizes: '1200x630',
            type: 'image/png',
            form_factor: 'wide',
            label: 'MeetLite Video Conferencing Platform',
          },
        ],
        related_applications: [],
        prefer_related_applications: false,
        iarc_rating_id: '',
      },
    }),
  ],
  server: {
    port: 5174,
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
