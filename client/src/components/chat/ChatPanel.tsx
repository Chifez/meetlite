import { useEffect, useRef, useMemo } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { useAuth } from '@/hooks/useAuth';
import { ChatState } from '@/types/chat';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  chatState: ChatState;
  onSendMessage: (message: string) => void;
  onTogglePanel: () => void;
  onMarkAsRead: () => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  className?: string;
}

export const ChatPanel = ({
  chatState,
  onSendMessage,
  onTogglePanel,
  onMarkAsRead,
  onTypingStart,
  onTypingStop,
  className,
}: ChatPanelProps) => {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Memoized computations to prevent unnecessary re-renders
  const memoizedValues = useMemo(() => {
    // Get typing users (exclude current user)
    const typingUsers = Object.entries(chatState.isTyping)
      .filter(([userId, isTyping]) => isTyping && userId !== user?.id)
      .map(([userId]) => userId);

    // Group consecutive messages from the same user
    const groupedMessages: Array<{
      messages: typeof chatState.messages;
      userId: string;
      userEmail: string;
    }> = [];

    chatState.messages.forEach((message) => {
      const lastGroup = groupedMessages[groupedMessages.length - 1];
      if (lastGroup && lastGroup.userId === message.userId) {
        lastGroup.messages.push(message);
      } else {
        groupedMessages.push({
          messages: [message],
          userId: message.userId,
          userEmail: message.userEmail,
        });
      }
    });

    return { typingUsers, groupedMessages };
  }, [chatState.isTyping, chatState.messages, user?.id]);

  // Consolidated effect for scroll behavior and read status
  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive and panel is open
    if (chatState.isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    // Mark as read when panel is opened and there are unread messages
    if (chatState.isOpen && chatState.unreadCount > 0) {
      onMarkAsRead();
    }
  }, [
    chatState.messages.length,
    chatState.isOpen,
    chatState.unreadCount,
    onMarkAsRead,
  ]);

  return (
    <>
      {chatState.isOpen ? (
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 top-0 z-50 bg-background border-l flex flex-col h-screen',
            'md:relative md:inset-auto md:w-80 md:h-full',
            className
          )}
        >
          {/* Header - Fixed at top */}
          <div className="flex items-center justify-between p-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <h3 className="font-medium">Chat</h3>
              {chatState.unreadCount > 0 && (
                <Badge variant="secondary" className="h-5 px-2 text-xs">
                  {chatState.unreadCount}
                </Badge>
              )}
            </div>
            <Button
              onClick={onTogglePanel}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages Area - Scrollable middle section */}
          <div className="flex-1 h-[75vh] overflow-scroll scrollbar-hide">
            <div className="p-0">
              {memoizedValues.groupedMessages.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                </div>
              ) : (
                memoizedValues.groupedMessages.map((group, groupIndex) => (
                  <div key={`group-${groupIndex}`}>
                    {group.messages.map((message, messageIndex) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        isOwn={message.userId === user?.id}
                        showAvatar={messageIndex === 0}
                      />
                    ))}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Footer area - Fixed at bottom */}
          <div className="shrink-0">
            {/* Typing Indicator */}
            <TypingIndicator typingUsers={memoizedValues.typingUsers} />

            {/* Input Area */}
            <ChatInput
              onSendMessage={onSendMessage}
              onTypingStart={onTypingStart}
              onTypingStop={onTypingStop}
              placeholder="Type your message..."
            />
          </div>
        </div>
      ) : null}
    </>
  );
};
