import { Network, PenTool, Settings2, X, BarChart3 } from 'lucide-react';
import { useRoom } from '@/contexts/room-context';

export interface MenuItem {
  key: string;
  icon: any;
  onClick: () => void;
  isActive: boolean;
  title: string;
  isPopover?: boolean;
}

interface UseCollaborationMenuItemsProps {
  isPresenting: boolean;
  onModeChange: (mode: 'workflow' | 'whiteboard') => void;
  onStopPresenting: () => void;
  onClose: () => void;
}

export const useCollaborationMenuItems = ({
  isPresenting,
  onModeChange,
  onStopPresenting,
  onClose,
}: UseCollaborationMenuItemsProps): MenuItem[] => {
  const { collaborationState } = useRoom();
  const currentMode = collaborationState?.mode || 'none';

  const menuItems: MenuItem[] = [
    {
      key: 'workflow',
      icon: Network,
      onClick: () => onModeChange('workflow'),
      isActive: currentMode === 'workflow',
      title: 'Workflow',
    },
    {
      key: 'whiteboard',
      icon: PenTool,
      onClick: () => onModeChange('whiteboard'),
      isActive: currentMode === 'whiteboard',
      title: 'Whiteboard',
    },
    {
      key: 'poll',
      icon: BarChart3,
      onClick: () => {
        // Add your poll handler here
        console.log('Poll clicked');
        onClose();
      },
      isActive: false,
      title: 'Create Poll',
    },
  ];

  if (isPresenting) {
    menuItems.push({
      key: 'settings',
      icon: Settings2,
      onClick: () => {},
      isActive: false,
      title: 'Settings',
      isPopover: true,
    });
    menuItems.push({
      key: 'cancel',
      icon: X,
      onClick: onStopPresenting,
      isActive: false,
      title: 'Stop Presenting',
    });
  }

  return menuItems;
};
