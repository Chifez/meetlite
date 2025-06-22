import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { io, Socket } from 'socket.io-client';
import { env } from '@/config/env';
import Cookies from 'js-cookie';

interface UseSocketSetupProps {
  roomId: string | undefined;
}

export const useSocketSetup = ({ roomId }: UseSocketSetupProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token || !roomId) {
      navigate('/dashboard');
      return;
    }

    const newSocket = io(env.SIGNALING_SERVER_URL, {
      auth: { token },
      query: { roomId },
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      setSocket(newSocket);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Could not connect to meeting server. Please try again.',
      });
      navigate('/dashboard');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId, navigate, toast]);

  return { socket, socketRef };
};
