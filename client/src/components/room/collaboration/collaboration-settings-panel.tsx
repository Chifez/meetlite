import { useState, useEffect } from 'react';
import { Settings, Users, Eye, Edit, UserCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRoom } from '@/contexts/room-context';
import { useAuth } from '@/hooks/use-auth';

type CollaborationMode = 'view-only' | 'allow-edit' | 'selective-edit';

interface CollaborationSettingsPanelProps {
  className?: string;
}

export const CollaborationSettingsPanel = ({
  className,
}: CollaborationSettingsPanelProps) => {
  const {
    peers,
    getParticipantEmail,
    updateCollaborationSettings,
    collaborationState,
  } = useRoom();
  const { user } = useAuth();

  // Sync with global state
  const [collaborationMode, setCollaborationMode] =
    useState<CollaborationMode>('allow-edit');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  // Fix presenter check
  const isPresenter = user?.id === collaborationState?.presenter?.userId;

  // Sync local state with global state
  useEffect(() => {
    if (collaborationState?.presenter?.collaborationSettings) {
      const { mode, allowedUsers } =
        collaborationState.presenter.collaborationSettings;
      setCollaborationMode(mode);
      setSelectedUsers(new Set(allowedUsers));
    }
  }, [collaborationState?.presenter?.collaborationSettings]);

  if (!isPresenter) {
    return null;
  }

  const handleModeChange = (mode: CollaborationMode) => {
    setCollaborationMode(mode);
    updateCollaborationSettings({
      mode,
      allowedUsers: mode === 'selective-edit' ? Array.from(selectedUsers) : [],
    });
  };

  const handleUserToggle = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);

    if (collaborationMode === 'selective-edit') {
      updateCollaborationSettings({
        mode: collaborationMode,
        allowedUsers: Array.from(newSelected),
      });
    }
  };

  const participants = Array.from(peers.entries()).map(([_, peer]) => ({
    id: peer.id,
    email: getParticipantEmail(peer.id) || 'Unknown User',
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Collaboration Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Collaboration Mode Selection */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Collaboration Mode</Label>

          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Switch
                checked={collaborationMode === 'view-only'}
                onCheckedChange={() => handleModeChange('view-only')}
              />
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <Label>View Only</Label>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Switch
                checked={collaborationMode === 'allow-edit'}
                onCheckedChange={() => handleModeChange('allow-edit')}
              />
              <div className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                <Label>Allow Edit</Label>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Switch
                checked={collaborationMode === 'selective-edit'}
                onCheckedChange={() => handleModeChange('selective-edit')}
              />
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                <Label>Selective Edit</Label>
              </div>
            </div>
          </div>
        </div>

        {/* Selective Edit User List */}
        {collaborationMode === 'selective-edit' && (
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Select Users with Edit Access
            </Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center space-x-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(participant.id)}
                    onChange={(e) =>
                      handleUserToggle(participant.id, e.target.checked)
                    }
                  />
                  <Label className="text-sm">{participant.email}</Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Status */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {collaborationMode === 'view-only' && 'Others can only view'}
              {collaborationMode === 'allow-edit' && 'Others can edit freely'}
              {collaborationMode === 'selective-edit' &&
                `${selectedUsers.size} user${
                  selectedUsers.size !== 1 ? 's' : ''
                } can edit`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
