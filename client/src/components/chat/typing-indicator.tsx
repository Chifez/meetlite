import { memo } from 'react';

interface TypingIndicatorProps {
  typingUsers: string[]; // Array of user emails who are typing
}

const TypingIndicator = memo(({ typingUsers }: TypingIndicatorProps) => {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].split('@')[0]} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].split('@')[0]} and ${
        typingUsers[1].split('@')[0]
      } are typing...`;
    } else {
      return `${typingUsers.length} people are typing...`;
    }
  };

  return (
    <div className="px-4 py-2 text-sm text-muted-foreground border-t">
      <div className="flex items-center gap-2">
        <div className="flex space-x-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: '1s',
              }}
            />
          ))}
        </div>
        <span>{getTypingText()}</span>
      </div>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';

export { TypingIndicator };
