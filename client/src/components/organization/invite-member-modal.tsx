import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mail, UserPlus } from 'lucide-react';
import { useMembers } from '@/hooks/use-members';

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  canInviteOwners?: boolean;
}

interface InviteForm {
  email: string;
  role: 'member' | 'admin' | 'owner';
  message: string;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  canInviteOwners = false,
}) => {
  const { inviteMember, inviting } = useMembers();
  const [emailError, setEmailError] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InviteForm>({
    defaultValues: {
      email: '',
      role: 'member',
      message: '',
    },
  });

  const selectedRole = watch('role');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const onSubmit = async (data: InviteForm) => {
    if (!validateEmail(data.email)) {
      return;
    }

    // Modal stays open during operation (inviting state is handled by useMembers hook)
    const success = await inviteMember({
      organizationId,
      email: data.email.toLowerCase().trim(),
      role: data.role,
      message: data.message.trim(),
    });

    // Only close modal and reset form on success
    if (success) {
      reset();
      onOpenChange(false);
    }
    // On error, modal stays open so user can retry
  };

  const handleClose = () => {
    reset();
    setEmailError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Invite Member to {organizationName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="space-y-6 p-1">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    className="pl-10"
                    {...register('email', {
                      required: 'Email is required',
                      onChange: () => {
                        if (emailError) setEmailError('');
                      },
                    })}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
                {emailError && (
                  <p className="text-sm text-red-600">{emailError}</p>
                )}
              </div>

              {/* Role Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Role</Label>
                <RadioGroup
                  value={selectedRole}
                  onValueChange={(value: 'member' | 'admin' | 'owner') =>
                    setValue('role', value)
                  }
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted transition-colors">
                    <RadioGroupItem value="member" id="member" />
                    <div className="flex-1">
                      <Label
                        htmlFor="member"
                        className="font-medium cursor-pointer"
                      >
                        Member
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Can join meetings, participate in collaborations, and
                        view organization content
                      </p>
                    </div>
                  </div>

                  {canInviteOwners && (
                    <>
                      <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted transition-colors">
                        <RadioGroupItem value="admin" id="admin" />
                        <div className="flex-1">
                          <Label
                            htmlFor="admin"
                            className="font-medium cursor-pointer"
                          >
                            Admin
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Can invite members, create meetings, upload
                            recordings, and manage teams
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted transition-colors">
                        <RadioGroupItem value="owner" id="owner" />
                        <div className="flex-1">
                          <Label
                            htmlFor="owner"
                            className="font-medium cursor-pointer"
                          >
                            Owner
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Full access including member management, billing,
                            and organization settings
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </RadioGroup>
              </div>

              {/* Personal Message */}
              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-medium">
                  Personal Message{' '}
                  <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Textarea
                  id="message"
                  placeholder="Add a personal message to the invitation..."
                  rows={3}
                  maxLength={500}
                  {...register('message')}
                />
                <p className="text-xs text-muted-foreground">
                  This message will be included in the invitation email
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons - Fixed Footer */}
          <div className="flex gap-3 pt-4 border-t flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={inviting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={inviting}
              className="flex-1"
              onClick={handleSubmit(onSubmit)}
            >
              {inviting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </form>
    </Dialog>
  );
};
