import { useState } from 'react';
import { X, Presentation } from 'lucide-react';
import { useRoom } from '@/contexts/room-context';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { RadialMenuContainer } from './radial-menu-container';
import { useCollaborationMenuItems } from '@/hooks/use-collaboration-menu-items';
import { useCollaborationState } from '@/hooks/use-collaboration-state';

interface CollaborationMenuProps {
  className?: string;
  variant?: string;
}

export const CollaborationMenu = ({
  className,
  variant,
}: CollaborationMenuProps) => {
  const { changeCollaborationMode } = useRoom();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const { isDisabled, isPresenting } = useCollaborationState(user?.id);

  const menuItems = useCollaborationMenuItems({
    isPresenting,
    onModeChange: (mode: 'workflow' | 'whiteboard' | 'code') => {
      if (isDisabled) return;
      changeCollaborationMode(mode);
      setIsOpen(false);
    },
    onStopPresenting: () => {
      changeCollaborationMode('none');
      setIsOpen(false);
    },
    onClose: () => setIsOpen(false),
  });

  const isMobile = variant === 'mobile';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center gap-2',
        !isMobile && 'flex-col',
        className
      )}
    >
      {/* Main Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center justify-center rounded-xl h-10 w-10 border transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 z-10',
          isDisabled && 'opacity-50 cursor-not-allowed',
          isOpen
            ? 'bg-primary border-transparent text-white'
            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
        )}
        disabled={Boolean(isDisabled)}
      >
        {isOpen ? (
          <X className="h-4.5 w-4.5" />
        ) : (
          <Presentation className="h-4.5 w-4.5" />
        )}
      </button>

      {/* Radial Menu Items */}
      <RadialMenuContainer
        items={menuItems}
        isOpen={isOpen}
        isDisabled={isDisabled}
        isMobile={isMobile}
      />
    </div>
  );
};
