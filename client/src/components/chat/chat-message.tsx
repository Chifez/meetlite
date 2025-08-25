import { memo } from 'react';
import { ChatMessageComponentProps } from '@/types/chat';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const formatTime = (timestamp: Date): string => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const getInitials = (email: string): string => {
  return email.split('@')[0].slice(0, 2).toUpperCase();
};

const ChatMessage = memo(
  ({ message, isOwn, showAvatar = true }: ChatMessageComponentProps) => {
    const { userEmail, message: text, timestamp, type } = message;

    // Handle system messages differently
    if (type === 'system') {
      return (
        <div className="flex justify-center my-2">
          <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {text}
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          'flex gap-3 p-3 hover:bg-muted/50 transition-colors',
          isOwn && 'flex-row-reverse'
        )}
      >
        {showAvatar && (
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(userEmail)}
            </AvatarFallback>
          </Avatar>
        )}

        <div
          className={cn(
            'flex flex-col gap-1 min-w-0 flex-1',
            isOwn && 'items-end'
          )}
        >
          <div
            className={cn(
              'flex items-baseline gap-2',
              isOwn && 'flex-row-reverse'
            )}
          >
            <span className="text-sm font-medium text-foreground">
              {isOwn ? 'You' : userEmail.split('@')[0]}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(timestamp)}
            </span>
          </div>

          <div
            className={cn(
              'max-w-[280px] break-words rounded-lg px-3 py-2 text-sm',
              isOwn
                ? 'bg-primary text-primary-foreground ml-auto'
                : 'bg-muted text-foreground'
            )}
          >
            {text}
          </div>
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = 'ChatMessage';

export { ChatMessage };
