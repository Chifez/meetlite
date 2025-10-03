import { useState } from 'react';
import { Network, PenTool, X, Presentation, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoom } from '@/contexts/room-context';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CollaborationSettingsPanel } from '@/components/room/collaboration/collaboration-settings-panel';
import { useAuth } from '@/hooks/use-auth';

interface CollaborationMenuProps {
  className?: string;
  variant?: string;
}

export const CollaborationMenu = ({
  className,
  variant,
}: CollaborationMenuProps) => {
  const {
    socket,
    collaborationState,
    changeCollaborationMode,
    screenSharingUser,
    isScreenSharing,
  } = useRoom();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const currentMode = collaborationState?.mode || 'none';
  const isPresenting = currentMode !== 'none';
  const currentUserId = user?.id;
  const presenterUserId = collaborationState?.presenter?.userId;

  // Debug logging
  console.log('CollaborationMenu Debug:', {
    currentMode,
    isPresenting,
    presenterUserId,
    currentUserId,
    socket,
    socketId: socket?.id,
    isScreenSharing,
    screenSharingUser,
    isPresenter: presenterUserId === currentUserId,
    isDisabled:
      isScreenSharing ||
      (screenSharingUser && screenSharingUser !== currentUserId) ||
      (isPresenting &&
        presenterUserId !== currentUserId &&
        presenterUserId !== null),
  });

  // Disable controls if:
  // 1. Someone is screen sharing (not us) OR
  // 2. Someone else is presenting (not us)
  const isDisabled =
    isScreenSharing ||
    (screenSharingUser && screenSharingUser !== currentUserId) ||
    (isPresenting &&
      presenterUserId !== currentUserId &&
      presenterUserId !== null);

  const handleModeChange = (mode: 'workflow' | 'whiteboard') => {
    if (isDisabled) return;
    if (mode === currentMode) {
      // If clicking the active mode, do nothing
      return;
    }
    // Switch to the selected mode
    changeCollaborationMode(mode);
    setIsOpen(false);
  };

  const handleStopPresenting = () => {
    changeCollaborationMode('none');
    setIsOpen(false);
  };

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
          className={cn(
            'rounded-full h-12 w-12',
            isDisabled && 'opacity-50 cursor-not-allowed'
          )}
          disabled={Boolean(isDisabled)}
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
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4 pointer-events-none'
          )}
        >
          {/* Workflow Button */}
          <Button
            variant={currentMode === 'workflow' ? 'default' : 'outline'}
            size="icon"
            onClick={() => handleModeChange('workflow')}
            title="Workflow"
            className={cn(
              'rounded-full h-8 w-8',
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
            disabled={Boolean(isDisabled)}
          >
            <Network className="h-4 w-4" />
          </Button>

          {/* Whiteboard Button */}
          <Button
            variant={currentMode === 'whiteboard' ? 'default' : 'outline'}
            size="icon"
            onClick={() => handleModeChange('whiteboard')}
            title="Whiteboard"
            className={cn(
              'rounded-full h-8 w-8',
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
            disabled={Boolean(isDisabled)}
          >
            <PenTool className="h-4 w-4" />
          </Button>

          {/* Settings Button */}
          {isPresenting && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  title="Settings"
                  className="rounded-full h-8 w-8"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 p-0"
                align="center"
                side="top"
                sideOffset={20}
              >
                <CollaborationSettingsPanel />
              </PopoverContent>
            </Popover>
          )}

          {/* Cancel Button */}
          {isPresenting && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleStopPresenting}
              title="Stop Presenting"
              className="rounded-full h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
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
        className={cn(
          'rounded-full h-12 w-12',
          isDisabled && 'opacity-50 cursor-not-allowed'
        )}
        disabled={Boolean(isDisabled)}
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
        {/* Workflow Button */}
        <Button
          variant={currentMode === 'workflow' ? 'default' : 'outline'}
          size="icon"
          onClick={() => handleModeChange('workflow')}
          title="Workflow"
          className={cn(
            'rounded-full h-8 w-8',
            isDisabled && 'opacity-50 cursor-not-allowed'
          )}
          disabled={Boolean(isDisabled)}
        >
          <Network className="h-4 w-4" />
        </Button>

        {/* Whiteboard Button */}
        <Button
          variant={currentMode === 'whiteboard' ? 'default' : 'outline'}
          size="icon"
          onClick={() => handleModeChange('whiteboard')}
          title="Whiteboard"
          className={cn(
            'rounded-full h-8 w-8',
            isDisabled && 'opacity-50 cursor-not-allowed'
          )}
          disabled={Boolean(isDisabled)}
        >
          <PenTool className="h-4 w-4" />
        </Button>

        {/* Settings Button */}
        {isPresenting && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                title="Settings"
                className="rounded-full h-8 w-8"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 p-0"
              align="end"
              side="top"
              sideOffset={20}
            >
              <CollaborationSettingsPanel />
            </PopoverContent>
          </Popover>
        )}

        {/* Cancel Button */}
        {isPresenting && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleStopPresenting}
            title="Stop Presenting"
            className="rounded-full h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
