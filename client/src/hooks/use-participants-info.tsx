import { useState, useCallback, useRef } from 'react';

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

  // Use ref to avoid dependency on participantInfo Map in callbacks
  const participantInfoRef = useRef(participantInfo);
  participantInfoRef.current = participantInfo;

  const updateParticipantInfo = useCallback(
    (info: Record<string, ParticipantInfo>) => {
      setParticipantInfo((prev) => {
        const newMap = new Map(prev);
        Object.entries(info).forEach(([userId, participantInfo]) => {
          newMap.set(userId, participantInfo);
        });
        return newMap;
      });
    },
    []
  );

  const getParticipantEmail = useCallback(
    (userId: string): string | undefined => {
      return participantInfoRef.current.get(userId)?.email;
    },
    []
  );

  const getParticipantDisplayName = useCallback(
    (userId: string): string | undefined => {
      const info = participantInfoRef.current.get(userId);

      if (!info) {
        return undefined;
      }

      // Use name if available and useNameInMeetings is true
      if (info.useNameInMeetings && info.name) {
        return info.name;
      }

      // Fallback to email
      return info.email;
    },
    []
  );

  const removeParticipantInfo = useCallback((userId: string) => {
    setParticipantInfo((prev) => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
  }, []);

  const clearParticipantInfo = useCallback(() => {
    setParticipantInfo(new Map());
  }, []);

  return {
    participantInfo,
    updateParticipantInfo,
    removeParticipantInfo,
    getParticipantEmail,
    getParticipantDisplayName,
    clearParticipantInfo,
  };
};
