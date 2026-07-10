import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/auth-context.tsx';
import { WorkspaceProvider } from './contexts/workspace-context.tsx';
import { NotificationsProvider } from './contexts/notifications-context.tsx';
import { CalendarProvider } from './contexts/calendar-context.tsx';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async';

// Create a QueryClient instance with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Register PWA service worker (for push notifications)
// We register manually to ensure push notifications work correctly with our custom sw.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);

        // Handle service worker updates to prevent duplicate requests
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New service worker installed, but old one still active
                // User needs to refresh to activate new worker
                console.log(
                  'New service worker available - refresh to activate'
                );
              }
            });
          }
        });
      })
      .catch((registrationError) => {
        console.error('Service Worker registration failed:', registrationError);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthProvider>
              <WorkspaceProvider>
                <NotificationsProvider>
                  <CalendarProvider>
                    <App />
                    <Toaster richColors />
                  </CalendarProvider>
                </NotificationsProvider>
              </WorkspaceProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
