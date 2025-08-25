import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MoreOptionsMenuProps {
  onRefreshConnection: () => void;
  onReturnToLobby: () => void;
}

export const MoreOptionsMenu = ({
  onRefreshConnection,
  onReturnToLobby,
}: MoreOptionsMenuProps) => {
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
        <DropdownMenuContent align="end">
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
