import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MonitorUp,
  MonitorOff,
  Users,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRoom } from '@/contexts/RoomContext';

interface RoomControlsProps {
  onRefreshConnection: () => void;
  onReturnToLobby: () => void;
}

export const RoomControls: React.FC<RoomControlsProps> = ({
  onRefreshConnection,
  onReturnToLobby,
}) => {
  const {
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    screenSharingUser,
    toggleAudio,
    toggleVideo,
    shareScreen,
    leaveMeeting,
    socket,
    peers,
  } = useRoom();

  const canShareScreen =
    !screenSharingUser || (socket && screenSharingUser === socket.id);

  return (
    <>
      {/* Mobile Participant Count - Sticky on right side */}
      <div className="fixed bottom-24 right-4 z-10 md:hidden">
        <Button
          variant="outline"
          size="sm"
          className="gap-1 bg-background/90 backdrop-blur-sm"
        >
          <Users className="h-4 w-4" />
          <span>{peers.size + 1}</span>
        </Button>
      </div>

      {/* Main Controls Bar */}
      <div className="bg-background border-t py-4 relative bg-[#121212]">
        <div className="container max-w-6xl mx-auto px-4">
          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between">
            {/* Left: Participant Count */}
            <div className="flex items-center gap-2 min-w-[120px]">
              <Button variant="outline" size="sm" className="gap-1">
                <Users className="h-4 w-4" />
                <span>{peers.size + 1}</span>
              </Button>
            </div>

            {/* Center: Main Controls */}
            <div className="flex items-center gap-3 justify-center">
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-12 w-12 transition-colors ${
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
                className={`rounded-full h-12 w-12 transition-colors ${
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
                className="rounded-full h-12 w-12 transition-colors"
                onClick={leaveMeeting}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={shareScreen}
                disabled={!canShareScreen}
                className={`rounded-full h-12 w-12 transition-colors ${
                  isScreenSharing
                    ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                    : ''
                }`}
              >
                {isScreenSharing ? (
                  <MonitorOff className="h-5 w-5" />
                ) : (
                  <MonitorUp className="h-5 w-5" />
                )}
              </Button>
            </div>

            {/* Right: More Options */}
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
          </div>

          {/* Mobile Layout - Centered Controls */}
          <div className="flex md:hidden items-center justify-center">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-12 w-12 transition-colors ${
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
                className={`rounded-full h-12 w-12 transition-colors ${
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
                className="rounded-full h-12 w-12 transition-colors"
                onClick={leaveMeeting}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={shareScreen}
                disabled={!canShareScreen}
                className={`hidden rounded-full h-12 w-12 transition-colors ${
                  isScreenSharing
                    ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                    : ''
                }`}
              >
                {isScreenSharing ? (
                  <MonitorOff className="h-5 w-5" />
                ) : (
                  <MonitorUp className="h-5 w-5" />
                )}
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
          </div>
        </div>
      </div>
    </>
  );
};
