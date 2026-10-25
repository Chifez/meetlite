import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { io, Socket } from 'socket.io-client';
import { env } from '@/config/env';
import { getAuthToken } from '@/lib/token-storage';

interface UseSocketSetupProps {
  roomId: string | undefined;
}

export const useSocketSetup = ({ roomId }: UseSocketSetupProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const connectionErrorShownRef = useRef(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !roomId) {
      navigate('/dashboard');
      return;
    }

    const newSocket = io(env.MEDIASOUP_SERVER_URL, {
      auth: { token },
      query: { roomId },
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      connectionErrorShownRef.current = false;
      setSocket(newSocket);
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus('reconnecting');
    });

    newSocket.io.on('reconnect', () => {
      connectionErrorShownRef.current = false;
      setConnectionStatus('connected');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setConnectionStatus('reconnecting');
      if (!connectionErrorShownRef.current) {
        connectionErrorShownRef.current = true;
        toast({
          variant: 'destructive',
          title: 'Connection Error',
          description:
            'Could not connect to meeting server. Retrying automatically…',
        });
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId, navigate, toast]);

  return { socket, socketRef, connectionStatus, setConnectionStatus };
};
