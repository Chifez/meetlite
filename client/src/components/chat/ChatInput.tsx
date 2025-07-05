import { useState, useRef, KeyboardEvent, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Smile } from 'lucide-react';
import { ChatInputProps } from '@/types/chat';

// Common emojis for quick access
const QUICK_EMOJIS = ['👍', '👎', '😂', '❤️', '😮', '😢', '😡', '👏'];

export const ChatInput = ({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  disabled = false,
  placeholder = 'Type a message...',
}: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const handleSendMessage = useCallback(() => {
    if (!message.trim() || disabled) return;

    onSendMessage(message);
    setMessage('');

    // Stop typing indicator
    if (isTyping) {
      onTypingStop();
      setIsTyping(false);
    }

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [message, disabled, onSendMessage, onTypingStop, isTyping]);

  const handleInputChange = useCallback(
    (value: string) => {
      setMessage(value);

      // Handle typing indicators
      if (value.trim() && !isTyping) {
        setIsTyping(true);
        onTypingStart();
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing
      if (value.trim()) {
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          onTypingStop();
        }, 1000);
      } else if (isTyping) {
        setIsTyping(false);
        onTypingStop();
      }
    },
    [isTyping, onTypingStart, onTypingStop]
  );

  const handleKeyPress = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const addEmoji = useCallback(
    (emoji: string) => {
      const newMessage = message + emoji;
      setMessage(newMessage);
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    },
    [message]
  );

  const handleEmojiToggle = useCallback(() => {
    setShowEmojiPicker((prev) => !prev);
  }, []);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative border-t bg-background p-4">
      {/* Quick Emoji Picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-full left-4 right-4 mb-2 p-3 bg-popover border rounded-lg shadow-lg">
          <div className="grid grid-cols-8 gap-2">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className="text-lg hover:bg-muted rounded p-1 transition-colors"
                disabled={disabled}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* Emoji Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleEmojiToggle}
          disabled={disabled}
          className="shrink-0"
        >
          <Smile className="h-5 w-5" />
        </Button>

        {/* Message Input */}
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full"
            autoComplete="off"
          />
        </div>

        {/* Send Button */}
        <Button
          type="button"
          onClick={handleSendMessage}
          disabled={disabled || !message.trim()}
          size="icon"
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
