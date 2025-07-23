import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';
import { useToast } from '@/hooks/use-toast';
import { env } from '@/config/env';

interface UseMediasoupSocketProps {
  roomId?: string;
}

export const useMediasoupSocket = ({ roomId }: UseMediasoupSocketProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token || !roomId) {
      console.warn(
        '⚠️ [MediasoupSocket] No token or room ID, redirecting to dashboard'
      );
      navigate('/dashboard');
      return;
    }

    if (socketRef.current?.connected) {
      console.log('🔌 [MediasoupSocket] Already connected, reusing socket');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    console.log(
      `🔌 [MediasoupSocket] Connecting to mediasoup service: ${env.MEDIASOUP_SERVER_URL}`
    );

    const newSocket = io(env.MEDIASOUP_SERVER_URL, {
      auth: { token },
      query: { roomId },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
    });

    socketRef.current = newSocket;

    // Connection success
    newSocket.on('connect', () => {
      console.log('✅ [MediasoupSocket] Connected to mediasoup service');
      setSocket(newSocket);
      setIsConnecting(false);
      setConnectionError(null);
    });

    // Connection error
    newSocket.on('connect_error', (err) => {
      console.error('❌ [MediasoupSocket] Connection error:', err);
      setIsConnecting(false);
      setConnectionError(err.message || 'Connection failed');

      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Could not connect to media server. Please try again.',
      });

      // Don't redirect immediately, give user chance to retry
      setTimeout(() => {
        if (!newSocket.connected) {
          navigate('/dashboard');
        }
      }, 5000);
    });

    // Disconnection
    newSocket.on('disconnect', (reason) => {
      console.warn(`🔌 [MediasoupSocket] Disconnected: ${reason}`);
      setSocket(null);

      if (
        reason === 'io server disconnect' ||
        reason === 'io client disconnect'
      ) {
        // Server disconnected or client disconnected, don't try to reconnect
        navigate('/dashboard');
      }
    });

    // Reconnection attempt
    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 [MediasoupSocket] Reconnection attempt ${attemptNumber}`);
      setIsConnecting(true);
    });

    // Reconnection success
    newSocket.on('reconnect', (attemptNumber) => {
      console.log(
        `✅ [MediasoupSocket] Reconnected after ${attemptNumber} attempts`
      );
      setIsConnecting(false);
      setConnectionError(null);

      toast({
        title: 'Reconnected',
        description: 'Successfully reconnected to media server.',
      });
    });

    // Reconnection failed
    newSocket.on('reconnect_failed', () => {
      console.error('❌ [MediasoupSocket] Reconnection failed');
      setIsConnecting(false);
      setConnectionError('Reconnection failed');

      toast({
        variant: 'destructive',
        title: 'Connection Lost',
        description:
          'Could not reconnect to media server. Returning to dashboard.',
      });

      navigate('/dashboard');
    });

    // Server error
    newSocket.on('error', (error) => {
      console.error('❌ [MediasoupSocket] Server error:', error);
      toast({
        variant: 'destructive',
        title: 'Server Error',
        description: error.message || 'Media server error occurred.',
      });
    });

    // Cleanup on unmount
    return () => {
      console.log('🔌 [MediasoupSocket] Cleaning up socket connection');
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnecting(false);
      setConnectionError(null);
    };
  }, [roomId, navigate, toast]);

  return {
    socket,
    socketRef,
    isConnecting,
    connectionError,
    isConnected: socket?.connected || false,
  };
};
