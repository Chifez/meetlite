import { useState } from 'react';
import { Network, PenTool, X, Share2, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoom } from '@/contexts/RoomContext';
import { cn } from '@/lib/utils';

interface CollaborationMenuProps {
  className?: string;
  variant?: string;
}

export const CollaborationMenu = ({
  className,
  variant,
}: CollaborationMenuProps) => {
  const { socket, collaborationState, changeCollaborationMode } = useRoom();
  const [isOpen, setIsOpen] = useState(false);

  const handleModeChange = (mode: 'none' | 'workflow' | 'whiteboard') => {
    if (socket) {
      if (mode === collaborationState?.mode) {
        changeCollaborationMode('none');
      } else {
        changeCollaborationMode(mode);
      }
    }
  };

  const currentMode = collaborationState?.mode || 'none';

  if (variant === 'mobile') {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center gap-2',
          className
        )}
      >
        {/* Main Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-full h-12 w-12"
        >
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Presentation className="h-5 w-5" />
          )}
        </Button>

        {/* Tool Buttons with Spring Animation */}
        <div
          className={cn(
            'absolute bottom-[calc(100%+0.5rem)] flex flex-col items-center justify-center gap-2',
            'transition-all duration-300 ease-spring',
            isOpen
              ? 'opacity-100 translate-y-0 '
              : 'opacity-0 translate-y-4 pointer-events-none'
          )}
        >
          <Button
            variant={currentMode === 'workflow' ? 'default' : 'outline'}
            size="icon"
            onClick={() => handleModeChange('workflow')}
            title="Workflow"
            className="rounded-full h-8 w-8"
          >
            <Network className="h-4 w-4" />
          </Button>

          <Button
            variant={currentMode === 'whiteboard' ? 'default' : 'outline'}
            size="icon"
            onClick={() => handleModeChange('whiteboard')}
            title="Whiteboard"
            className="rounded-full h-8 w-8"
          >
            <PenTool className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center gap-2',
        className
      )}
    >
      {/* Main Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full h-12 w-12"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Presentation className="h-5 w-5" />
        )}
      </Button>

      {/* Tool Buttons with Spring Animation */}
      <div
        className={cn(
          'min-w-fit absolute md:bottom-[calc(100%+0.5rem)] lg:bottom-[0.5rem] lg:left-[calc(100%+0.5rem)] flex flex-row items-center gap-2',
          'transition-all duration-300 ease-spring',
          isOpen
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 md:translate-y-4 lg:translate-y-0 lg:-translate-x-4 pointer-events-none'
        )}
      >
        <Button
          variant={currentMode === 'workflow' ? 'default' : 'outline'}
          size="icon"
          onClick={() => handleModeChange('workflow')}
          title="Workflow"
          className="rounded-full h-8 w-8"
        >
          <Network className="h-4 w-4" />
        </Button>

        <Button
          variant={currentMode === 'whiteboard' ? 'default' : 'outline'}
          size="icon"
          onClick={() => handleModeChange('whiteboard')}
          title="Whiteboard"
          className="rounded-full h-8 w-8"
        >
          <PenTool className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
