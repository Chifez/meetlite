import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Share,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRoom } from './RoomContext';

export const RoomControls = ({
  onRefreshConnection,
  onReturnToLobby,
}: {
  onRefreshConnection: () => void;
  onReturnToLobby: () => void;
}) => {
  const {
    audioEnabled,
    videoEnabled,
    toggleAudio,
    toggleVideo,
    leaveMeeting,
    shareScreen,
    peers,
  } = useRoom();

  return (
    <div className="bg-background border-t py-4">
      <div className="container max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1">
            <Users className="h-4 w-4" />
            <span>{peers.size + 1}</span>
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full h-12 w-12 ${
              !audioEnabled
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }`}
            onClick={toggleAudio}
          >
            {audioEnabled ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className={`rounded-full h-12 w-12 ${
              !videoEnabled
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }`}
            onClick={toggleVideo}
          >
            {videoEnabled ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant="destructive"
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={leaveMeeting}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={shareScreen}
          >
            <Share className="h-5 w-5" />
          </Button>

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
        <div className="w-20" /> {/* Spacer to balance the layout */}
      </div>
    </div>
  );
};
