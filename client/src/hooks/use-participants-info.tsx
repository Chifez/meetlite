import { useState, useCallback } from 'react';

interface ParticipantInfo {
  email: string;
  userId: string;
  name?: string;
  useNameInMeetings?: boolean;
}

export const useParticipantInfo = () => {
  const [participantInfo, setParticipantInfo] = useState<
    Map<string, ParticipantInfo>
  >(new Map());

  const updateParticipantInfo = useCallback(
    (info: Record<string, ParticipantInfo>) => {
      setParticipantInfo(new Map(Object.entries(info)));
    },
    []
  );

  const getParticipantEmail = useCallback(
    (userId: string): string | undefined => {
      return participantInfo.get(userId)?.email;
    },
    [participantInfo]
  );

  const getParticipantDisplayName = useCallback(
    (userId: string): string | undefined => {
      const info = participantInfo.get(userId);
      if (!info) return undefined;

      // Use name if available and useNameInMeetings is true
      if (info.useNameInMeetings && info.name) {
        return info.name;
      }

      // Fallback to email
      return info.email;
    },
    [participantInfo]
  );

  const clearParticipantInfo = useCallback(() => {
    setParticipantInfo(new Map());
  }, []);

  return {
    participantInfo,
    updateParticipantInfo,
    getParticipantEmail,
    getParticipantDisplayName,
    clearParticipantInfo,
  };
};
