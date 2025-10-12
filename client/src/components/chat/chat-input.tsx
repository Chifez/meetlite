import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Smile } from 'lucide-react';
import { ChatInputProps } from '@/types/chat';
import {
  IconEmojiPicker,
  emojiLibrary,
} from '@/components/ui/icon-emoji-picker';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const handleSendMessage = () => {
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
  };

  const handleInputChange = (value: string) => {
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
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const addEmoji = (iconName: string) => {
    const emoji = emojiLibrary[iconName];
    if (emoji) {
      const newMessage = message + emoji;
      setMessage(newMessage);
      handleInputChange(newMessage);
    }
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleEmojiToggle = () => {
    setShowEmojiPicker((prev) => !prev);
  };

  // Cleanup typing timeout on unmount

  return (
    <div className="relative border-t bg-background p-4">
      <div className="flex gap-2 items-end">
        {/* Emoji Button */}
        <div className="relative shrink-0">
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

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-full mb-12 left-0 z-50">
              <IconEmojiPicker
                onSelect={addEmoji}
                onClose={() => setShowEmojiPicker(false)}
                className="max-h-64"
              />
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full resize-none"
            autoComplete="off"
            rows={3}
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
