import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { io, Socket } from 'socket.io-client';
import { env } from '@/config/env';
import Cookies from 'js-cookie';
import api from '@/lib/axios';

interface UseSocketSetupProps {
  roomId: string | undefined;
}

export const useSocketSetup = ({ roomId }: UseSocketSetupProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token || !roomId) {
      navigate('/dashboard');
      return;
    }

    const setupSocket = async () => {
      try {
        // Fetch fresh profile data from auth service
        // Then send it to MediaSoup (MediaSoup doesn't fetch from DB)
        const profileResponse = await api.get('/api/auth/profile');
        const profile = profileResponse.data.user || profileResponse.data;

        // Connect to MediaSoup with token AND profile data
        const newSocket = io(env.MEDIASOUP_SERVER_URL, {
          auth: {
            token,
            // Send fresh profile data to MediaSoup
            profile: {
              name: profile.name,
              useNameInMeetings: profile.useNameInMeetings,
            },
          },
          query: { roomId },
        });

        socketRef.current = newSocket;

        newSocket.on('connect', () => {
          setSocket(newSocket);
          setConnectionStatus('connected');
        });

        newSocket.on('disconnect', () => {
          setConnectionStatus('reconnecting');
        });

        newSocket.io.on('reconnect', () => {
          setConnectionStatus('connected');
        });

        newSocket.on('connect_error', (err) => {
          console.error('Connection error:', err);
          toast({
            variant: 'destructive',
            title: 'Connection Error',
            description:
              'Could not connect to meeting server. Please try again.',
          });
          navigate('/dashboard');
        });
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        toast({
          variant: 'destructive',
          title: 'Setup Error',
          description: 'Could not load user profile. Please try again.',
        });
        navigate('/dashboard');
      }
    };

    setupSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId, navigate, toast]);

  return { socket, socketRef, connectionStatus, setConnectionStatus };
};
