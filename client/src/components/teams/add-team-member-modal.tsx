import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Users } from 'lucide-react';
import { useMembers } from '@/hooks/use-members';
import { TeamService } from '@/services/team-service';
import { useWorkspace } from '@/contexts/workspace-context';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface AddTeamMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  existingMemberIds: string[];
  onMemberAdded: () => void;
}

export const AddTeamMemberModal: React.FC<AddTeamMemberModalProps> = ({
  open,
  onOpenChange,
  teamId,
  teamName,
  existingMemberIds,
  onMemberAdded,
}) => {
  const { activeOrganization } = useWorkspace();
  const { members, fetchMembers } = useMembers();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'owner'>(
    'member'
  );
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open && activeOrganization?.id) {
      fetchMembers(activeOrganization.id);
    }
  }, [open, activeOrganization?.id, fetchMembers]);

  // Get available members (not already in team)
  const availableMembers =
    members?.members?.filter(
      (member) => !existingMemberIds.includes(member.id)
    ) || [];

  const handleAddMember = async () => {
    if (!selectedUserId || !activeOrganization?.id) return;

    try {
      setAdding(true);
      await TeamService.addMemberToTeam(
        activeOrganization.id,
        teamId,
        selectedUserId,
        selectedRole
      );
      toast.success('Member added to team successfully');
      setSelectedUserId('');
      setSelectedRole('member');
      onMemberAdded();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error adding member to team:', error);
      toast.error(
        error.response?.data?.message || 'Failed to add member to team'
      );
    } finally {
      setAdding(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Prevent closing while adding
    if (adding) return;
    onOpenChange(newOpen);
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Member to Team
          </DialogTitle>
          <DialogDescription>
            Add an organization member to <strong>@{teamName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Member Selection */}
          <div className="space-y-2">
            <Label htmlFor="member">Select Member</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="member">
                <SelectValue placeholder="Choose a member to add" />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p>All organization members are already in this team</p>
                  </div>
                ) : (
                  availableMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Role Selection */}
          {selectedUserId && (
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(value: 'member' | 'owner') =>
                  setSelectedRole(value)
                }
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Members can view and participate. Owners can manage team members
                and settings.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={adding}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddMember}
            disabled={!selectedUserId || adding}
          >
            {adding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
