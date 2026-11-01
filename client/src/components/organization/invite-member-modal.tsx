import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mail, UserPlus, User, ShieldCheck, Crown } from 'lucide-react';
import { useMembers } from '@/hooks/use-members';
import { InputTags, isValidEmail } from '@/components/scheduling/input-tags';
import { toast } from 'sonner';

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  canInviteOwners?: boolean;
}

type RoleType = 'member' | 'admin' | 'owner';

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  canInviteOwners = false,
}) => {
  const { inviteMember, inviting } = useMembers();
  const [emails, setEmails] = useState<string[]>([]);
  const [role, setRole] = useState<RoleType>('member');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState<string>('');

  const handleClose = () => {
    if (inviting) return;
    setEmails([]);
    setRole('member');
    setMessage('');
    setFormError('');
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (emails.length === 0) {
      setFormError('Please enter at least one email address');
      return;
    }

    const invalidEmails = emails.filter((e) => !isValidEmail(e));
    if (invalidEmails.length > 0) {
      setFormError(`Please correct invalid email${invalidEmails.length > 1 ? 's' : ''}: ${invalidEmails.join(', ')}`);
      return;
    }

    try {
      let successCount = 0;
      for (const email of emails) {
        const success = await inviteMember({
          organizationId,
          email: email.toLowerCase().trim(),
          role,
          message: message.trim(),
        });
        if (success) successCount++;
      }

      if (successCount > 0) {
        if (emails.length > 1) {
          toast.success(`Successfully sent ${successCount} invitation${successCount > 1 ? 's' : ''}`);
        }
        handleClose();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to send invitations');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !inviting && (val ? onOpenChange(val) : handleClose())}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border border-[#DAD7CF] dark:border-neutral-800 shadow-xl rounded-xl">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-[#DAD7CF] dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#EEEDE8] dark:bg-neutral-800 flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
                Invite to {organizationName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Teammates will receive an email invitation to join your workspace.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Email Tags Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Email addresses <span className="text-destructive">*</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                Press enter, comma, or paste list
              </span>
            </div>
            <InputTags
              tags={emails}
              onChange={(newTags) => {
                setEmails(newTags);
                if (formError) setFormError('');
              }}
              placeholder={emails.length === 0 ? 'colleague@company.com' : 'Add another email'}
              className="min-h-[38px] text-xs"
            />
            {formError && (
              <p className="text-[11px] font-medium text-destructive mt-1">
                {formError}
              </p>
            )}
          </div>

          {/* Role Selection Grouped List */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Workspace Role
            </label>
            <div className="border border-[#DAD7CF] dark:border-neutral-800 rounded-lg overflow-hidden divide-y divide-[#DAD7CF] dark:divide-neutral-800">
              {/* Member */}
              <button
                type="button"
                onClick={() => setRole('member')}
                className={`w-full p-2.5 flex items-start gap-3 text-left transition-colors ${
                  role === 'member'
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
                      checked={role === 'member'}
                      onChange={() => setRole('member')}
                      className="accent-primary h-3.5 w-3.5"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    Can schedule and join meetings, collaborate in active rooms, and access workspace resources.
                  </p>
                </div>
              </button>

              {/* Admin */}
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`w-full p-2.5 flex items-start gap-3 text-left transition-colors ${
                  role === 'admin'
                    ? 'bg-primary/5 dark:bg-primary/10'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="w-7 h-7 rounded-md bg-[#EEEDE8] dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Admin</span>
                    <input
                      type="radio"
                      checked={role === 'admin'}
                      onChange={() => setRole('admin')}
                      className="accent-primary h-3.5 w-3.5"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    Can manage member invites, create teams, configure room defaults, and view workspace analytics.
                  </p>
                </div>
              </button>

              {/* Owner (if allowed) */}
              {canInviteOwners && (
                <button
                  type="button"
                  onClick={() => setRole('owner')}
                  className={`w-full p-2.5 flex items-start gap-3 text-left transition-colors ${
                    role === 'owner'
                      ? 'bg-primary/5 dark:bg-primary/10'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="w-7 h-7 rounded-md bg-[#EEEDE8] dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Crown className="h-3.5 w-3.5 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Owner</span>
                      <input
                        type="radio"
                        checked={role === 'owner'}
                        onChange={() => setRole('owner')}
                        className="accent-primary h-3.5 w-3.5"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                      Full access to billing, ownership transfer, organization security, and domain controls.
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Personal Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Personal note <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a quick note to include in the email invitation..."
              rows={2}
              maxLength={300}
              className="resize-none text-xs border-[#DAD7CF] dark:border-neutral-800 focus-visible:ring-1 focus-visible:ring-primary rounded-lg py-2"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DAD7CF] dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={inviting}
              className="h-9 px-3.5 text-xs font-medium border-[#DAD7CF] dark:border-neutral-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={inviting}
              className="h-9 px-4 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {inviting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  {emails.length > 1 ? `Send ${emails.length} Invitations` : 'Send Invitation'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
