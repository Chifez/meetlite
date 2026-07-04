import { Users } from 'lucide-react';

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
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950/90 backdrop-blur-sm text-zinc-300 text-xs font-semibold shadow-lg">
          <Users className="h-3.5 w-3.5" />
          <span>{count}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-semibold">
        <Users className="h-3.5 w-3.5 text-zinc-400" />
        <span>{count}</span>
      </div>
    </div>
  );
};
