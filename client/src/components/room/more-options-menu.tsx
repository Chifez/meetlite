import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { LayoutMode } from '@/components/room/layout-toggle';

interface MoreOptionsMenuProps {
  onRefreshConnection: () => void;
  onReturnToLobby: () => void;
  // Layout toggle props
  currentLayoutMode?: LayoutMode;
  onLayoutModeChange?: (mode: LayoutMode) => void;
  participantCount?: number;
  isPresenting?: boolean;
}

export const MoreOptionsMenu = ({
  onRefreshConnection,
  onReturnToLobby,
  currentLayoutMode,
  onLayoutModeChange,
  participantCount = 0,
  isPresenting = false,
}: MoreOptionsMenuProps) => {
  const layoutOptions = [
    {
      mode: 'grid' as LayoutMode,
      label: 'Grid View',
      description: 'See everyone in a grid',
      disabled: false,
    },
    {
      mode: 'speaker' as LayoutMode,
      label: 'Speaker View',
      description: 'Focus on active speakers',
      disabled: participantCount < 2,
    },
    {
      mode: 'presentation' as LayoutMode,
      label: 'Presentation View',
      description: 'Optimized for content sharing',
      disabled: !isPresenting,
    },
  ];

  const handleLayoutChange = (mode: LayoutMode) => {
    if (
      onLayoutModeChange &&
      !layoutOptions.find((opt) => opt.mode === mode)?.disabled
    ) {
      onLayoutModeChange(mode);
    }
  };

  return (
    <div className="flex justify-end min-w-[120px]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-12 w-12"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {/* Layout Options */}
          {onLayoutModeChange && (
            <>
              <div className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                Layout Options
              </div>
              {layoutOptions.map((option) => {
                const isSelected = option.mode === currentLayoutMode;
                return (
                  <DropdownMenuItem
                    key={option.mode}
                    onClick={() => handleLayoutChange(option.mode)}
                    disabled={option.disabled}
                    className={`px-2 py-1.5 ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex flex-col">
                      <span
                        className={`text-sm ${isSelected ? 'font-medium' : ''}`}
                      >
                        {option.label}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {option.description}
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Other Options */}
          <DropdownMenuItem onClick={onRefreshConnection}>
            Refresh Connection
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onReturnToLobby}>
            Return to Lobby
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
