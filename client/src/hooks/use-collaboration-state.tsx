import { useRoom } from '@/contexts/room-context';

export const useCollaborationState = (currentUserId?: string) => {
  const { socket, collaborationState, screenSharingUser, isScreenSharing } =
    useRoom();

  const currentMode = collaborationState?.mode || 'none';
  const isPresenting = currentMode !== 'none';
  const presenterUserId = collaborationState?.presenter?.userId;

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
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
    });
  }

  // Disable controls if:
  // 1. Someone is screen sharing (not us) OR
  // 2. Someone else is presenting (not us)
  const isDisabled =
    isScreenSharing ||
    (screenSharingUser && screenSharingUser !== currentUserId) ||
    (isPresenting &&
      presenterUserId !== currentUserId &&
      presenterUserId !== null);

  return {
    currentMode,
    isPresenting,
    isDisabled,
    presenterUserId,
  };
};
