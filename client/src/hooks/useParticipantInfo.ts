import { useState, useCallback } from 'react';

interface ParticipantInfo {
  email: string;
  userId: string;
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

  const clearParticipantInfo = useCallback(() => {
    setParticipantInfo(new Map());
  }, []);

  return {
    participantInfo,
    updateParticipantInfo,
    getParticipantEmail,
    clearParticipantInfo,
  };
};
