export interface ChatMessage {
  id: string;
  userId: string;
  userEmail: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'system' | 'emoji';
}

export interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  unreadCount: number;
  isTyping: Record<string, string | undefined>; // userId -> userEmail (if typing)
}

export interface ChatContextType {
  chatState: ChatState;
  sendMessage: (message: string, type?: ChatMessage['type']) => void;
  toggleChatPanel: () => void;
  markAsRead: () => void;
  startTyping: () => void;
  stopTyping: () => void;
}

export interface TypingIndicator {
  userId: string;
  userEmail: string;
  timestamp: Date;
}

// Socket event types for chat
export interface ChatSocketEvents {
  'chat:message': (data: Omit<ChatMessage, 'id'>) => void;
  'chat:typing-start': (data: { userId: string; userEmail: string }) => void;
  'chat:typing-stop': (data: { userId: string }) => void;
}

export interface ChatMessageComponentProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar?: boolean;
}

export interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  disabled?: boolean;
  placeholder?: string;
}
