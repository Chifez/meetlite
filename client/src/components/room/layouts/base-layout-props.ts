import { Participant } from '@/components/room/types';
import { LayoutMode } from '@/components/room/layout-toggle';
import { LayoutConfig } from '@/utils/layout-engine';

export interface BaseLayoutProps {
  participants: Participant[];
  layoutConfig: LayoutConfig;
  layoutMode: LayoutMode;
  layoutClasses: {
    container: string;
    grid: string;
    participant: string;
    mainSpeaker: string;
    secondarySpeaker: string;
    zoomScale: number;
  };
  onPinParticipant: (participantId: string) => void;
  screenSize: 'small' | 'medium' | 'large';
}
