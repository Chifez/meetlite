import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
// import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SIGNALING_SERVER = 'http://localhost:5002';

interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  // const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [audioEnabled, setAudioEnabled] = useState<boolean>(
    sessionStorage.getItem('meetlite_audio_enabled') !== 'false'
  );
  const [videoEnabled, setVideoEnabled] = useState<boolean>(
    sessionStorage.getItem('meetlite_video_enabled') !== 'false'
  );
  const [participantCount, setParticipantCount] = useState(1); // Including self
  const [peerMediaState, setPeerMediaState] = useState<Map<string, MediaState>>(
    new Map()
  );

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());

  // Connect to signaling server and set up media
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !roomId) {
      navigate('/dashboard');
      return;
    }

    // Connect to signaling server
    const newSocket = io(SIGNALING_SERVER, {
      auth: { token },
      query: { roomId },
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Setup event listeners
    newSocket.on('connect', () => {
      console.log('Connected to signaling server');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Could not connect to meeting server. Please try again.',
      });
      navigate('/dashboard');
    });

    // Get saved device preferences
    const audioDeviceId =
      sessionStorage.getItem('meetlite_audio_device') || undefined;
    const videoDeviceId =
      sessionStorage.getItem('meetlite_video_device') || undefined;

    // Get user media
    const getMedia = async () => {
      try {
        const constraints = {
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
          video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Apply saved mute states
        stream.getAudioTracks().forEach((track) => {
          track.enabled = audioEnabled;
        });

        stream.getVideoTracks().forEach((track) => {
          track.enabled = videoEnabled;
        });

        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Signal ready to server with initial media state
        newSocket.emit('ready', {
          roomId,
          mediaState: {
            audioEnabled,
            videoEnabled,
          },
        });
      } catch (error) {
        console.error('Error accessing media devices:', error);
        toast({
          variant: 'destructive',
          title: 'Media Error',
          description:
            'Could not access camera or microphone. Please check permissions.',
        });
        navigate('/lobby/' + roomId);
      }
    };

    getMedia();

    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }

      peersRef.current.forEach((peer) => {
        peer.connection.close();
      });
    };
  }, [roomId, navigate, toast, audioEnabled, videoEnabled]);

  // Set up peer connections when socket is ready
  useEffect(() => {
    if (!socket || !localStream) return;

    // Handle new user joining
    const handleUserJoined = (userId: string) => {
      console.log(`User joined: ${userId}`);
      // Create a new peer connection for the joining user
      createPeerConnection(userId, true);
    };

    // Handle incoming call (offer)
    const handleCallUser = (data: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      console.log(`Call from: ${data.from}`);
      // Create a peer connection and handle the incoming offer
      const peer = createPeerConnection(data.from, false);

      // Set the remote description (offer)
      peer.connection
        .setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => {
          // Create answer
          return peer.connection.createAnswer();
        })
        .then((answer) => {
          // Set local description (answer)
          return peer.connection.setLocalDescription(answer);
        })
        .then(() => {
          // Send answer back to caller
          socket.emit('answer', {
            to: data.from,
            answer: peer.connection.localDescription,
          });
        })
        .catch((error) => {
          console.error('Error handling offer:', error);
        });
    };

    // Handle answer to our offer
    const handleAnswerMade = (data: {
      from: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      console.log(`Answer from: ${data.from}`);

      const peer = peersRef.current.get(data.from);
      if (peer) {
        peer.connection
          .setRemoteDescription(new RTCSessionDescription(data.answer))
          .catch((error) => {
            console.error('Error setting remote description:', error);
          });
      }
    };

    // Handle ICE candidate
    const handleIceCandidate = (data: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      console.log(`ICE candidate from: ${data.from}`);

      const peer = peersRef.current.get(data.from);
      if (peer) {
        peer.connection
          .addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch((error) => {
            console.error('Error adding ICE candidate:', error);
          });
      }
    };

    // Handle user leaving
    const handleUserLeft = (userId: string) => {
      console.log(`User left: ${userId}`);

      const peer = peersRef.current.get(userId);
      if (peer) {
        peer.connection.close();
        peersRef.current.delete(userId);
        setPeers(new Map(peersRef.current));
      }

      // Update participant count
      setParticipantCount((prevCount) => Math.max(1, prevCount - 1));
    };

    // Handle room data update
    const handleRoomData = (data: {
      participants: string[];
      mediaState: Record<string, MediaState>;
    }) => {
      console.log('Room data update:', data);
      setParticipantCount(data.participants.length);

      // Update peer media state
      const newMediaState = new Map(Object.entries(data.mediaState));
      setPeerMediaState(newMediaState);
    };

    // Handle media state updates
    const handleMediaStateUpdate = (data: {
      userId: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
    }) => {
      console.log('Media state update:', data);
      setPeerMediaState((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          audioEnabled: data.audioEnabled,
          videoEnabled: data.videoEnabled,
        });
        return next;
      });
    };

    // Register event listeners
    socket.on('user-joined', handleUserJoined);
    socket.on('call-user', handleCallUser);
    socket.on('answer-made', handleAnswerMade);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('room-data', handleRoomData);
    socket.on('media-state-update', handleMediaStateUpdate);

    // Clean up on unmount
    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('call-user', handleCallUser);
      socket.off('answer-made', handleAnswerMade);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
      socket.off('room-data', handleRoomData);
      socket.off('media-state-update', handleMediaStateUpdate);
    };
  }, [socket, localStream]);

  // Create a new peer connection
  const createPeerConnection = (userId: string, isInitiator: boolean) => {
    console.log(
      `Creating peer connection with ${userId}, initiator: ${isInitiator}`
    );

    // Check if we already have a connection to this peer
    if (peersRef.current.has(userId)) {
      return peersRef.current.get(userId)!;
    }

    // ICE servers configuration (STUN/TURN)
    const iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    // Create new RTCPeerConnection
    const connection = new RTCPeerConnection(iceServers);

    // Add local stream tracks to the connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        connection.addTrack(track, localStream);
      });
    }

    // Create a new peer object with media state
    const peer: PeerConnection = {
      id: userId,
      connection,
    };

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('ice-candidate', {
          to: userId,
          candidate: event.candidate,
        });
      }
    };

    // Handle incoming stream
    connection.ontrack = (event) => {
      console.log(`Got remote track from ${userId}`);

      // Create a new stream from incoming tracks
      if (event.streams && event.streams[0]) {
        peer.stream = event.streams[0];

        // Update peers state
        setPeers(new Map(peersRef.current));
      }
    };

    // Initiator creates and sends offer
    if (isInitiator && socketRef.current) {
      console.log(`Creating offer for ${userId}`);

      connection
        .createOffer()
        .then((offer) => {
          return connection.setLocalDescription(offer);
        })
        .then(() => {
          socketRef.current?.emit('call-user', {
            to: userId,
            offer: connection.localDescription,
          });
        })
        .catch((error) => {
          console.error('Error creating offer:', error);
        });
    }

    // Store the peer connection
    peersRef.current.set(userId, peer);
    setPeers(new Map(peersRef.current));

    return peer;
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const newState = !audioEnabled;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = newState;
      });
      setAudioEnabled(newState);

      // Emit media state change
      socket?.emit('media-state-change', {
        roomId,
        audioEnabled: newState,
        videoEnabled,
      });
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const newState = !videoEnabled;
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = newState;
      });
      setVideoEnabled(newState);

      // Emit media state change
      socket?.emit('media-state-change', {
        roomId,
        audioEnabled,
        videoEnabled: newState,
      });
    }
  };

  // Leave meeting
  const leaveMeeting = () => {
    navigate('/dashboard');
  };

  // Share screen
  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      // Replace video track with screen track for all peers
      const videoTrack = screenStream.getVideoTracks()[0];

      if (localStream && videoTrack) {
        const senders: any = [];

        // Collect all RTCRtpSenders from all peer connections
        peersRef.current.forEach((peer) => {
          peer.connection.getSenders().forEach((sender) => {
            if (sender.track?.kind === 'video') {
              senders.push(sender);
            }
          });
        });

        // Replace track for each sender
        const promises = senders.map(
          (sender: { replaceTrack: (arg0: MediaStreamTrack) => any }) =>
            sender.replaceTrack(videoTrack)
        );

        // Update local video display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Handle user ending screen share
        videoTrack.onended = () => {
          // Get original video track
          const originalVideoTrack = localStream.getVideoTracks()[0];

          if (originalVideoTrack) {
            // Replace screen track with original video track
            senders.forEach(
              (sender: { replaceTrack: (arg0: MediaStreamTrack) => void }) => {
                sender.replaceTrack(originalVideoTrack);
              }
            );

            // Update local video display
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStream;
            }
          }
        };

        await Promise.all(promises);

        toast({
          title: 'Screen Sharing',
          description: 'You are now sharing your screen',
        });
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
      toast({
        variant: 'destructive',
        title: 'Screen Sharing Failed',
        description: 'Could not share your screen. Please try again.',
      });
    }
  };

  // Determine grid class based on number of participants
  const getGridClass = () => {
    const count = peersRef.current.size + 1; // +1 for local user
    return `participants-grid-${count}`;
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-hidden bg-background p-4">
        <div className={`video-grid h-full ${getGridClass()}`}>
          {/* Local video */}
          <div className="video-container">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`${!videoEnabled ? 'hidden' : ''}`}
            />

            {!videoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <VideoOff className="h-12 w-12 text-muted-foreground" />
              </div>
            )}

            <div className="video-label">You</div>
          </div>

          {/* Remote videos */}
          {Array.from(peers.values()).map((peer) => {
            const mediaState = peerMediaState.get(peer.id) || {
              audioEnabled: true,
              videoEnabled: true,
            };
            return (
              <div key={peer.id} className="video-container">
                {peer.stream ? (
                  <>
                    <video
                      autoPlay
                      playsInline
                      muted={!mediaState.audioEnabled}
                      ref={(el) => {
                        if (el && peer.stream) {
                          el.srcObject = peer.stream;
                        }
                      }}
                      className={`${!mediaState.videoEnabled ? 'hidden' : ''}`}
                    />
                    {!mediaState.videoEnabled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted">
                        <VideoOff className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <Users className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="video-label">
                  Participant{' '}
                  {!mediaState.audioEnabled && (
                    <MicOff className="h-4 w-4 inline ml-1" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Meeting controls */}
      <div className="bg-background border-t py-4">
        <div className="container max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1">
              <Users className="h-4 w-4" />
              <span>{participantCount}</span>
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
                <DropdownMenuItem onClick={() => window.location.reload()}>
                  Refresh Connection
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/lobby/${roomId}`)}>
                  Return to Lobby
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="w-20" /> {/* Spacer to balance the layout */}
        </div>
      </div>
    </div>
  );
};

export default Room;
