import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mail } from 'lucide-react';
import { TeamInvitationService } from '@/services/team-invitation-service';
import { useWorkspace } from '@/contexts/workspace-context';
import { toast } from 'sonner';

interface TeamInvitationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  onInvitationSent: () => void;
}

export const TeamInvitationModal: React.FC<TeamInvitationModalProps> = ({
  open,
  onOpenChange,
  teamId,
  teamName,
  onInvitationSent,
}) => {
  const { activeOrganization } = useWorkspace();
  const [email, setEmail] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'owner'>(
    'member'
  );
  const [message, setMessage] = useState('');
  const [inviting, setInviting] = useState(false);

  const handleSendInvitation = async () => {
    if (!email || !activeOrganization?.id) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setInviting(true);
      await TeamInvitationService.inviteToTeam(activeOrganization.id, teamId, {
        email: email.trim().toLowerCase(),
        role: selectedRole,
        message: message.trim() || undefined,
      });

      toast.success('Team invitation sent successfully');
      setEmail('');
      setSelectedRole('member');
      setMessage('');
      onInvitationSent();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending team invitation:', error);
      toast.error(
        error.response?.data?.message || 'Failed to send team invitation'
      );
    } finally {
      setInviting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Prevent closing while inviting
    if (inviting) return;
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite to Team
          </DialogTitle>
          <DialogDescription>
            Send an email invitation to join <strong>@{teamName}</strong>. If
            they're not part of the organization yet, they'll be added
            automatically when they accept.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={inviting}
            />
            <p className="text-xs text-muted-foreground">
              Enter the email address of the person you want to invite
            </p>
          </div>

          {/* Role Selection */}
          {email && (
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(value: 'member' | 'owner') =>
                  setSelectedRole(value)
                }
                disabled={inviting}
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

          {/* Optional Message */}
          {email && (
            <div className="space-y-2">
              <Label htmlFor="message">Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal message to the invitation..."
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={inviting}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={inviting}
          >
            Cancel
          </Button>
          <Button onClick={handleSendInvitation} disabled={!email || inviting}>
            {inviting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
