import { Tldraw } from '@tldraw/tldraw';
import { useSync } from '@tldraw/sync';
import '@tldraw/tldraw/tldraw.css';
import { useParams } from 'react-router-dom';
import { useRoom } from '@/contexts/room-context';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';
import { getSyncUrl, multiplayerAssets } from '@/lib/tldraw/sync-config';
import { useMemo } from 'react';

interface WhiteboardPanelProps {
  className?: string;
}

export const WhiteboardPanel = ({ className }: WhiteboardPanelProps) => {
  const { socket, collaborationState, canEdit } = useRoom();
  const { user } = useAuth();
  const { roomId } = useParams<{ roomId: string }>();
  const isPresenter = user?.id === collaborationState?.presenter?.userId;
  const canUserEdit = user?.id ? canEdit(user.id) : false;

  // Create sync store
  const store = useSync({
    uri: roomId ? getSyncUrl(roomId) : '',
    assets: multiplayerAssets,
  });

  const components = useMemo(() => {
    if (canUserEdit) return undefined; // Show all UI for editors

    return {
      // Hide action buttons that allow editing
      ActionsMenu: null,
      // Hide main menu for non-editors (optional)
      MainMenu: null,
      // Hide the toolbar completely for view-only users
      Toolbar: null,
      // Hide style panel
      StylePanel: null,
      // Hide quick actions
      QuickActions: null,
    };
  }, [canUserEdit]);

  // Return early if not in whiteboard mode
  if (!socket || collaborationState?.mode !== 'whiteboard') {
    return null;
  }

  // Return early if no roomId
  if (!roomId) {
    console.error('WhiteboardPanel: No roomId available');
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">
            Loading Whiteboard...
          </div>
          <div className="text-sm text-gray-500">
            Waiting for room information
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Permission Badge - Repositioned to avoid UI conflicts */}
      <div className="absolute top-4 left-4 z-20">
        <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2">
          {isPresenter && <Crown className="h-4 w-4 text-yellow-600" />}
          <Badge
            variant={canUserEdit ? 'default' : 'secondary'}
            className="text-xs"
          >
            {isPresenter ? 'Presenter' : canUserEdit ? 'Can Edit' : 'View Only'}
          </Badge>
        </div>
      </div>

      {/* Whiteboard Container */}
      <div className="w-full h-full">
        {/* <Tldraw
          store={store}
          hideUi={!canUserEdit}
          read
          onMount={(editor) => {
            console.log('Tldraw mounted successfully');
            // Set read-only mode based on permissions
            editor.updateInstanceState({
              isReadonly: !canUserEdit,
            });

            // Also disable specific tools for non-editors
            if (!canUserEdit) {
              editor.setSelectedTool('select');
              editor.setIsReadonly(true);
            }
          }}
          onUpdate={(editor) => {
            // Ensure read-only state is maintained
            if (!canUserEdit && !editor.isReadonly) {
              editor.setIsReadonly(true);
            }
          }}
        /> */}

        <Tldraw
          inferDarkMode
          store={store}
          // Conditionally show/hide UI components
          components={components}
          onMount={(editor) => {
            console.log('Tldraw mounted successfully');

            // Set read-only mode based on permissions
            editor.updateInstanceState({
              isReadonly: !canUserEdit,
            });

            // Additional security: Listen for permission changes
            const handlePermissionChange = () => {
              if (!canUserEdit) {
                // Force select tool and clear selection for non-editors
                editor.setCurrentTool('select');
                editor.selectNone(); // Correct method name

                // Prevent any ongoing interactions
                editor.interrupt();
              }
            };

            handlePermissionChange();
          }}
          // onUiEvent={(editor: any) => {
          //   if (!canUserEdit) return;
          //   // Ensure read-only state is maintained based on permissions
          //   if (editor) {
          //     const currentReadonly = editor?.getInstanceState()?.isReadonly;
          //     const shouldBeReadonly = !canUserEdit;

          //     if (currentReadonly !== shouldBeReadonly) {
          //       editor?.updateInstanceState({
          //         isReadonly: shouldBeReadonly,
          //       });

          //       if (shouldBeReadonly) {
          //         editor?.setCurrentTool('select');
          //         editor?.selectNone();
          //       }
          //     }
          //   }
          // }}
        />
      </div>
    </div>
  );
};
