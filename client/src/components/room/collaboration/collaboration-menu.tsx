// import { useState } from 'react';
// import {
//   Network,
//   PenTool,
//   X,
//   Presentation,
//   Settings2,
//   BarChart3,
// } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { useRoom } from '@/contexts/room-context';
// import { cn } from '@/lib/utils';
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from '@/components/ui/popover';
// import { CollaborationSettingsPanel } from '@/components/room/collaboration/collaboration-settings-panel';
// import { useAuth } from '@/hooks/use-auth';

// interface CollaborationMenuProps {
//   className?: string;
//   variant?: string;
// }

// export const CollaborationMenu = ({
//   className,
//   variant,
// }: CollaborationMenuProps) => {
//   const {
//     socket,
//     collaborationState,
//     changeCollaborationMode,
//     screenSharingUser,
//     isScreenSharing,
//   } = useRoom();
//   const { user } = useAuth();
//   const [isOpen, setIsOpen] = useState(false);

//   const currentMode = collaborationState?.mode || 'none';
//   const isPresenting = currentMode !== 'none';
//   const currentUserId = user?.id;
//   const presenterUserId = collaborationState?.presenter?.userId;

//   // Debug logging
//   console.log('CollaborationMenu Debug:', {
//     currentMode,
//     isPresenting,
//     presenterUserId,
//     currentUserId,
//     socket,
//     socketId: socket?.id,
//     isScreenSharing,
//     screenSharingUser,
//     isPresenter: presenterUserId === currentUserId,
//     isDisabled:
//       isScreenSharing ||
//       (screenSharingUser && screenSharingUser !== currentUserId) ||
//       (isPresenting &&
//         presenterUserId !== currentUserId &&
//         presenterUserId !== null),
//   });

//   // Disable controls if:
//   // 1. Someone is screen sharing (not us) OR
//   // 2. Someone else is presenting (not us)
//   const isDisabled =
//     isScreenSharing ||
//     (screenSharingUser && screenSharingUser !== currentUserId) ||
//     (isPresenting &&
//       presenterUserId !== currentUserId &&
//       presenterUserId !== null);

//   const handleModeChange = (mode: 'workflow' | 'whiteboard') => {
//     if (isDisabled) return;
//     if (mode === currentMode) {
//       // If clicking the active mode, do nothing
//       return;
//     }
//     // Switch to the selected mode
//     changeCollaborationMode(mode);
//     setIsOpen(false);
//   };

//   const handleStopPresenting = () => {
//     changeCollaborationMode('none');
//     setIsOpen(false);
//   };

//   // Calculate radial positions
//   const radius = 60; // Distance from center
//   const getRadialPosition = (
//     index: number,
//     total: number,
//     isMobile: boolean = false
//   ) => {
//     if (isMobile) {
//       // Mobile: distribute vertically along the right side
//       // Angles from -45° (upper-right) to 45° (lower-right)
//       const startAngle = -45;
//       const endAngle = 45;
//       const angleSpread = endAngle - startAngle;

//       let angle;
//       if (total === 1) {
//         angle = 0; // Single item directly to the right
//       } else if (total === 2) {
//         angle = index === 0 ? -30 : 30;
//       } else {
//         angle = startAngle + (angleSpread / (total - 1)) * index;
//       }

//       const radian = (angle * Math.PI) / 180;

//       return {
//         x: Math.cos(radian) * radius,
//         y: Math.sin(radian) * radius,
//       };
//     }

//     // Desktop: distribute across top semi-circle
//     const startAngle = 180; // Start from left
//     const endAngle = 0; // End at right
//     const angleSpread = startAngle - endAngle; // 180 degrees total

//     let angle;
//     if (total === 1) {
//       angle = 90; // Single item at top
//     } else if (total === 2) {
//       // Two items: upper-left and upper-right
//       angle = index === 0 ? 135 : 45;
//     } else {
//       // Three or more: distribute evenly across top half
//       angle = startAngle - (angleSpread / (total - 1)) * index;
//     }

//     const radian = (angle * Math.PI) / 180;

//     return {
//       x: Math.cos(radian) * radius,
//       y: -Math.sin(radian) * radius, // Negative because y increases downward in CSS
//     };
//   };

//   // Prepare menu items
//   const menuItems = [
//     {
//       key: 'workflow',
//       icon: Network,
//       onClick: () => handleModeChange('workflow'),
//       isActive: currentMode === 'workflow',
//       title: 'Workflow',
//     },
//     {
//       key: 'whiteboard',
//       icon: PenTool,
//       onClick: () => handleModeChange('whiteboard'),
//       isActive: currentMode === 'whiteboard',
//       title: 'Whiteboard',
//     },
//     {
//       key: 'poll',
//       icon: BarChart3,
//       onClick: () => {
//         // Add your poll handler here
//         console.log('Poll clicked');
//         setIsOpen(false);
//       },
//       isActive: false,
//       title: 'Create Poll',
//     },
//   ];

//   if (isPresenting) {
//     menuItems.push({
//       key: 'settings',
//       icon: Settings2,
//       onClick: () => {},
//       isActive: false,
//       title: 'Settings',
//     });
//     menuItems.push({
//       key: 'cancel',
//       icon: X,
//       onClick: handleStopPresenting,
//       isActive: false,
//       title: 'Stop Presenting',
//     });
//   }

//   if (variant === 'mobile') {
//     return (
//       <div
//         className={cn(
//           'relative flex items-center justify-center gap-2',
//           className
//         )}
//       >
//         {/* Main Toggle Button */}
//         <Button
//           variant="outline"
//           size="icon"
//           onClick={() => setIsOpen(!isOpen)}
//           className={cn(
//             'rounded-full h-12 w-12 relative z-10',
//             isDisabled && 'opacity-50 cursor-not-allowed'
//           )}
//           disabled={Boolean(isDisabled)}
//         >
//           {isOpen ? (
//             <X className="h-5 w-5" />
//           ) : (
//             <Presentation className="h-5 w-5" />
//           )}
//         </Button>

//         {/* Radial Menu Items */}
//         <div className="absolute inset-0 pointer-events-none">
//           {menuItems.map((item, index) => {
//             const pos = getRadialPosition(index, menuItems.length, true);
//             const Icon = item.icon;

//             if (item.key === 'settings' && isPresenting) {
//               return (
//                 <Popover key={item.key}>
//                   <PopoverTrigger asChild>
//                     <Button
//                       variant="outline"
//                       size="icon"
//                       title={item.title}
//                       className={cn(
//                         'absolute rounded-full h-8 w-8 pointer-events-auto transition-all duration-300',
//                         isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
//                       )}
//                       style={{
//                         left: '50%',
//                         top: '50%',
//                         transform: isOpen
//                           ? `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`
//                           : 'translate(-50%, -50%)',
//                         transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
//                       }}
//                     >
//                       <Icon className="h-4 w-4" />
//                     </Button>
//                   </PopoverTrigger>
//                   <PopoverContent
//                     className="w-80 p-0"
//                     align="center"
//                     side="top"
//                     sideOffset={20}
//                   >
//                     <CollaborationSettingsPanel />
//                   </PopoverContent>
//                 </Popover>
//               );
//             }

//             return (
//               <Button
//                 key={item.key}
//                 variant={item.isActive ? 'default' : 'outline'}
//                 size="icon"
//                 onClick={item.onClick}
//                 title={item.title}
//                 className={cn(
//                   'absolute rounded-full h-8 w-8 pointer-events-auto transition-all duration-300',
//                   isDisabled && 'opacity-50 cursor-not-allowed',
//                   isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
//                 )}
//                 style={{
//                   left: '50%',
//                   top: '50%',
//                   transform: isOpen
//                     ? `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`
//                     : 'translate(-50%, -50%)',
//                   transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
//                 }}
//                 disabled={Boolean(isDisabled)}
//               >
//                 <Icon className="h-4 w-4" />
//               </Button>
//             );
//           })}
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div
//       className={cn(
//         'relative flex flex-col items-center justify-center gap-2',
//         className
//       )}
//     >
//       {/* Main Toggle Button */}
//       <Button
//         variant="outline"
//         size="icon"
//         onClick={() => setIsOpen(!isOpen)}
//         className={cn(
//           'rounded-full h-12 w-12 relative z-10',
//           isDisabled && 'opacity-50 cursor-not-allowed'
//         )}
//         disabled={Boolean(isDisabled)}
//       >
//         {isOpen ? (
//           <X className="h-5 w-5" />
//         ) : (
//           <Presentation className="h-5 w-5" />
//         )}
//       </Button>

//       {/* Radial Menu Items */}
//       <div className="absolute inset-0 pointer-events-none">
//         {menuItems.map((item, index) => {
//           const pos = getRadialPosition(index, menuItems.length, false);
//           const Icon = item.icon;

//           if (item.key === 'settings' && isPresenting) {
//             return (
//               <Popover key={item.key}>
//                 <PopoverTrigger asChild>
//                   <Button
//                     variant="outline"
//                     size="icon"
//                     title={item.title}
//                     className={cn(
//                       'absolute rounded-full h-8 w-8 pointer-events-auto transition-all duration-300',
//                       isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
//                     )}
//                     style={{
//                       left: '50%',
//                       top: '50%',
//                       transform: isOpen
//                         ? `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`
//                         : 'translate(-50%, -50%)',
//                       transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
//                     }}
//                   >
//                     <Icon className="h-4 w-4" />
//                   </Button>
//                 </PopoverTrigger>
//                 <PopoverContent
//                   className="w-80 p-0"
//                   align="end"
//                   side="top"
//                   sideOffset={20}
//                 >
//                   <CollaborationSettingsPanel />
//                 </PopoverContent>
//               </Popover>
//             );
//           }

//           return (
//             <Button
//               key={item.key}
//               variant={item.isActive ? 'default' : 'outline'}
//               size="icon"
//               onClick={item.onClick}
//               title={item.title}
//               className={cn(
//                 'absolute rounded-full h-8 w-8 pointer-events-auto transition-all duration-300',
//                 isDisabled && 'opacity-50 cursor-not-allowed',
//                 isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
//               )}
//               style={{
//                 left: '50%',
//                 top: '50%',
//                 transform: isOpen
//                   ? `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`
//                   : 'translate(-50%, -50%)',
//                 transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
//               }}
//               disabled={Boolean(isDisabled)}
//             >
//               <Icon className="h-4 w-4" />
//             </Button>
//           );
//         })}
//       </div>
//     </div>
//   );
// };

import { useState } from 'react';
import { X, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoom } from '@/contexts/room-context';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { RadialMenuContainer } from './radial-menu-container';
import { useCollaborationMenuItems } from '@/hooks/use-collaboration-menu-items';
import { useCollaborationState } from '@/hooks/use-collaboration-state';

interface CollaborationMenuProps {
  className?: string;
  variant?: string;
}

export const CollaborationMenu = ({
  className,
  variant,
}: CollaborationMenuProps) => {
  const { changeCollaborationMode } = useRoom();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const { isDisabled, isPresenting } = useCollaborationState(user?.id);

  const menuItems = useCollaborationMenuItems({
    isPresenting,
    onModeChange: (mode: 'workflow' | 'whiteboard') => {
      if (isDisabled) return;
      changeCollaborationMode(mode);
      setIsOpen(false);
    },
    onStopPresenting: () => {
      changeCollaborationMode('none');
      setIsOpen(false);
    },
    onClose: () => setIsOpen(false),
  });

  const isMobile = variant === 'mobile';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center gap-2',
        !isMobile && 'flex-col',
        className
      )}
    >
      {/* Main Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'rounded-full h-12 w-12 relative z-10',
          isDisabled && 'opacity-50 cursor-not-allowed'
        )}
        disabled={Boolean(isDisabled)}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Presentation className="h-5 w-5" />
        )}
      </Button>

      {/* Radial Menu Items */}
      <RadialMenuContainer
        items={menuItems}
        isOpen={isOpen}
        isDisabled={isDisabled}
        isMobile={isMobile}
      />
    </div>
  );
};
