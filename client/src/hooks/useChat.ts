import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { ChatMessage, ChatState } from '@/types/chat';
import { useAuth } from './useAuth';

interface UseChatProps {
  socket: Socket | null;
  roomId?: string;
}

export const useChat = ({ socket, roomId }: UseChatProps) => {
  const { user } = useAuth();
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isOpen: false,
    unreadCount: 0,
    isTyping: {},
  });

  // Memoized user data to prevent unnecessary re-renders
  const currentUser = useMemo(() => user, [user?.id, user?.email]);

  // Send message
  const sendMessage = useCallback(
    (message: string, type: ChatMessage['type'] = 'text') => {
      if (!socket || !currentUser || !message.trim()) return;

      const chatMessage: Omit<ChatMessage, 'id'> = {
        userId: currentUser.id,
        userEmail: currentUser.email,
        message: message.trim(),
        timestamp: new Date(),
        type,
      };

      socket.emit('chat:message', { roomId, ...chatMessage });
    },
    [socket, currentUser, roomId]
  );

  // Toggle chat panel
  const toggleChatPanel = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      isOpen: !prev.isOpen,
      unreadCount: prev.isOpen ? prev.unreadCount : 0, // Clear unread count when opening
    }));
  }, []);

  // Mark messages as read
  const markAsRead = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      unreadCount: 0,
    }));
  }, []);

  // Optimized typing functions with proper cleanup
  const startTyping = useCallback(() => {
    if (!socket || !currentUser) return;

    socket.emit('chat:typing-start', {
      roomId,
      userId: currentUser.id,
      userEmail: currentUser.email,
    });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      if (socket && currentUser) {
        socket.emit('chat:typing-stop', {
          roomId,
          userId: currentUser.id,
        });
      }
    }, 3000);
  }, [socket, currentUser, roomId]);

  const stopTyping = useCallback(() => {
    if (!socket || !currentUser) return;

    socket.emit('chat:typing-stop', {
      roomId,
      userId: currentUser.id,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [socket, currentUser, roomId]);

  // Consolidated socket event listeners and cleanup
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleChatMessage = (data: Omit<ChatMessage, 'id'>) => {
      const messageWithId: ChatMessage = {
        ...data,
        id: crypto.randomUUID(),
        timestamp: new Date(data.timestamp),
      };

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, messageWithId],
        unreadCount: prev.isOpen ? prev.unreadCount : prev.unreadCount + 1,
      }));
    };

    const handleTypingStart = (data: { userId: string; userEmail: string }) => {
      if (data.userId === currentUser.id) return;

      setChatState((prev) => ({
        ...prev,
        isTyping: {
          ...prev.isTyping,
          [data.userId]: true,
        },
      }));
    };

    const handleTypingStop = (data: { userId: string }) => {
      setChatState((prev) => ({
        ...prev,
        isTyping: {
          ...prev.isTyping,
          [data.userId]: false,
        },
      }));
    };

    const handleUserLeft = (userId: string) => {
      setChatState((prev) => ({
        ...prev,
        isTyping: {
          ...prev.isTyping,
          [userId]: false,
        },
      }));
    };

    // Register all event listeners
    socket.on('chat:message', handleChatMessage);
    socket.on('chat:typing-start', handleTypingStart);
    socket.on('chat:typing-stop', handleTypingStop);
    socket.on('user-left', handleUserLeft);

    // Cleanup function
    return () => {
      socket.off('chat:message', handleChatMessage);
      socket.off('chat:typing-start', handleTypingStart);
      socket.off('chat:typing-stop', handleTypingStop);
      socket.off('user-left', handleUserLeft);

      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, currentUser?.id]); // Only depend on essential values

  return {
    chatState,
    sendMessage,
    toggleChatPanel,
    markAsRead,
    startTyping,
    stopTyping,
  };
};
