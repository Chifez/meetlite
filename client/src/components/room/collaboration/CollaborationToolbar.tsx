import { Network, PenTool, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoom } from '@/contexts/RoomContext';

interface CollaborationToolbarProps {
  className?: string;
}

export const CollaborationToolbar = ({
  className,
}: CollaborationToolbarProps) => {
  const { socket, collaborationState, changeCollaborationMode } = useRoom();

  const handleModeChange = (mode: 'none' | 'workflow' | 'whiteboard') => {
    if (socket) {
      changeCollaborationMode(mode);
    }
  };

  const currentMode = collaborationState?.mode || 'none';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant={currentMode === 'workflow' ? 'default' : 'outline'}
        size="icon"
        onClick={() => handleModeChange('workflow')}
        title="Workflow"
      >
        <Network className="h-4 w-4" />
      </Button>

      <Button
        variant={currentMode === 'whiteboard' ? 'default' : 'outline'}
        size="icon"
        onClick={() => handleModeChange('whiteboard')}
        title="Whiteboard"
      >
        <PenTool className="h-4 w-4" />
      </Button>

      {currentMode !== 'none' && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleModeChange('none')}
          title="Close Collaboration"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
