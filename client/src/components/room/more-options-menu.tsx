import { MoreVertical } from 'lucide-react';
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
          <button
            className="inline-flex items-center justify-center rounded-xl h-10 w-10 border transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
          >
            <MoreVertical className="h-4.5 w-4.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-2xl border-zinc-800 bg-zinc-950 text-zinc-300">
          {onLayoutModeChange && (
            <>
              <div className="px-2.5 py-1.5 text-[0.6875rem] font-bold text-zinc-500 uppercase tracking-wider">
                Layout Options
              </div>
              {layoutOptions.map((option) => {
                const isSelected = option.mode === currentLayoutMode;
                return (
                  <DropdownMenuItem
                    key={option.mode}
                    onClick={() => handleLayoutChange(option.mode)}
                    disabled={option.disabled}
                    className={`px-2.5 py-2 cursor-pointer transition-colors focus:bg-zinc-900 focus:text-white rounded-lg ${
                      isSelected ? 'bg-primary/20 text-white font-medium' : 'text-zinc-400'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-[0.8125rem] ${isSelected ? 'text-white' : ''}`}>
                        {option.label}
                      </span>
                      <span className="text-[0.6875rem] text-zinc-500">
                        {option.description}
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator className="bg-zinc-900" />
            </>
          )}

          <DropdownMenuItem
            onClick={onRefreshConnection}
            className="px-2.5 py-2 cursor-pointer focus:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg text-[0.8125rem]"
          >
            Refresh Connection
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onReturnToLobby}
            className="px-2.5 py-2 cursor-pointer focus:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg text-[0.8125rem]"
          >
            Return to Lobby
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
