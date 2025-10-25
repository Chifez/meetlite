import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ParticipantCountProps {
  count: number;
  variant?: 'mobile' | 'desktop';
}

export const ParticipantCount = ({
  count,
  variant = 'desktop',
}: ParticipantCountProps) => {
  if (variant === 'mobile') {
    return (
      <div className="fixed bottom-24 right-4 z-10 md:hidden">
        <Button
          variant="outline"
          size="sm"
          className="gap-1 bg-background/90 backdrop-blur-sm"
        >
          <Users className="h-4 w-4" />
          <span>{count}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Button variant="outline" size="sm" className="gap-1">
        <Users className="h-4 w-4" />
        <span>{count}</span>
      </Button>
    </div>
  );
};
