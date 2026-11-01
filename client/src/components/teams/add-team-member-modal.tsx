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
import { Loader2, UserPlus, Users, User, ShieldCheck } from 'lucide-react';
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
  const [selectedRole, setSelectedRole] = useState<'member' | 'owner'>('member');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open && activeOrganization?.id) {
      fetchMembers(activeOrganization.id);
    }
  }, [open, activeOrganization?.id, fetchMembers]);

  // Available organization members not already in the team
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

  const handleClose = () => {
    if (adding) return;
    setSelectedUserId('');
    setSelectedRole('member');
    onOpenChange(false);
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
    <Dialog open={open} onOpenChange={(val) => !adding && (val ? onOpenChange(val) : handleClose())}>
      <DialogContent className="sm:max-w-[460px] p-0 gap-0 overflow-hidden border border-[#DAD7CF] dark:border-neutral-800 shadow-xl rounded-xl">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-[#DAD7CF] dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#EEEDE8] dark:bg-neutral-800 flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
                Add Member to Team
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Assign an existing organization member to <strong>@{teamName}</strong>
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Member Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Select teammate <span className="text-destructive">*</span>
            </label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-9 text-xs border-[#DAD7CF] dark:border-neutral-800 rounded-lg">
                <SelectValue placeholder="Choose a member to add" />
              </SelectTrigger>
              <SelectContent className="border-[#DAD7CF] dark:border-neutral-800 rounded-lg shadow-lg">
                {availableMembers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    <Users className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/40" />
                    <p>All workspace members are already on this team</p>
                  </div>
                ) : (
                  availableMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id} className="text-xs py-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                            {getInitials(member.name || member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-medium text-foreground leading-tight">
                            {member.name || 'Unnamed'}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {member.email}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Team Role Grouped Options */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Team Role
            </label>
            <div className="border border-[#DAD7CF] dark:border-neutral-800 rounded-lg overflow-hidden divide-y divide-[#DAD7CF] dark:divide-neutral-800">
              {/* Member */}
              <button
                type="button"
                onClick={() => setSelectedRole('member')}
                className={`w-full p-2.5 flex items-start gap-3 text-left transition-colors ${
                  selectedRole === 'member'
                    ? 'bg-primary/5 dark:bg-primary/10'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="w-7 h-7 rounded-md bg-[#EEEDE8] dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Member</span>
                    <input
                      type="radio"
                      checked={selectedRole === 'member'}
                      onChange={() => setSelectedRole('member')}
                      className="accent-primary h-3.5 w-3.5"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    Can participate in team meetings, view team schedules, and join team channels.
                  </p>
                </div>
              </button>

              {/* Team Lead / Owner */}
              <button
                type="button"
                onClick={() => setSelectedRole('owner')}
                className={`w-full p-2.5 flex items-start gap-3 text-left transition-colors ${
                  selectedRole === 'owner'
                    ? 'bg-primary/5 dark:bg-primary/10'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="w-7 h-7 rounded-md bg-[#EEEDE8] dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Team Lead (Owner)</span>
                    <input
                      type="radio"
                      checked={selectedRole === 'owner'}
                      onChange={() => setSelectedRole('owner')}
                      className="accent-primary h-3.5 w-3.5"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    Can add or remove team members, configure team defaults, and manage meetings.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DAD7CF] dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={adding}
              className="h-9 px-3.5 text-xs font-medium border-[#DAD7CF] dark:border-neutral-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddMember}
              disabled={!selectedUserId || adding}
              className="h-9 px-4 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {adding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Add Member
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
