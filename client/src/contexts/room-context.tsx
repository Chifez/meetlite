import { createContext, useContext, ReactNode } from 'react';
import { RoomContextType } from '@/components/room/types';

const RoomContext = createContext<RoomContextType | null>(null);

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};

interface RoomProviderProps {
  children: ReactNode;
  value: RoomContextType;
}

export const RoomProvider = ({ children, value }: RoomProviderProps) => {
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};
