import { RadialMenuItem } from './radial-menu-item';
import { type MenuItem } from '@/hooks/use-collaboration-menu-items';
import { getRadialPosition } from '@/components/room/collaboration/utils/radial-position-calculator';

interface RadialMenuContainerProps {
  items: MenuItem[];
  isOpen: boolean;
  isDisabled: boolean;
  isMobile: boolean;
}

export const RadialMenuContainer = ({
  items,
  isOpen,
  isDisabled,
  isMobile,
}: RadialMenuContainerProps) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {items.map((item, index) => {
        const pos = getRadialPosition(index, items.length, isMobile);

        return (
          <RadialMenuItem
            key={item.key}
            item={item}
            position={pos}
            isOpen={isOpen}
            isDisabled={isDisabled}
            index={index}
          />
        );
      })}
    </div>
  );
};
