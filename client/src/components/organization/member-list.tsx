import React, { useState } from 'react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Users,
  MoreVertical,
  Crown,
  Mail,
  Calendar,
  Trash2,
  X,
  Clock,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { useMembers } from '../../hooks/useMembers';
import type {
  OrganizationMember,
  PendingInvitation,
} from '../../services/memberService';

interface MemberListProps {
  organizationId: string;
  organizationName: string;
  members: OrganizationMember[];
  pendingInvitations: PendingInvitation[];
  userRole: 'owner' | 'member';
  memberCount: number;
  maxMembers: number;
  onInviteClick: () => void;
}

export const MemberList: React.FC<MemberListProps> = ({
  organizationId,
  organizationName,
  members,
  pendingInvitations,
  userRole,
  memberCount,
  maxMembers,
  onInviteClick,
}) => {
  const {
    removeMember,
    cancelInvitation,
    updateMemberRole,
    removing,
    canceling,
    updatingRole,
  } = useMembers();
  const [memberToRemove, setMemberToRemove] =
    useState<OrganizationMember | null>(null);
  const [invitationToCancel, setInvitationToCancel] =
    useState<PendingInvitation | null>(null);

  const isOwner = userRole === 'owner';
  const canInvite = isOwner && (maxMembers === -1 || memberCount < maxMembers);

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    const success = await removeMember(
      organizationId,
      memberToRemove.id,
      memberToRemove.name
    );
    if (success) {
      setMemberToRemove(null);
    }
  };

  const handleCancelInvitation = async () => {
    if (!invitationToCancel) return;

    const success = await cancelInvitation(
      organizationId,
      invitationToCancel.id,
      invitationToCancel.email
    );
    if (success) {
      setInvitationToCancel(null);
    }
  };

  const handleUpdateRole = async (
    memberId: string,
    newRole: 'owner' | 'member'
  ) => {
    await updateMemberRole(organizationId, memberId, newRole);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Team Members</h1>
            <p className="text-sm text-gray-600">
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
              {maxMembers !== -1 && ` of ${maxMembers} maximum`}
            </p>
          </div>
        </div>

        {canInvite && (
          <Button onClick={onInviteClick} className="gap-2" size="sm">
            <UserPlus className="h-4 w-4" />
            <p className="text-sm">Invite Member</p>
          </Button>
        )}
      </div>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Active Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No members yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 z-0">
                      <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.name}</span>
                        {member.isOwner && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{member.email}</p>
                      <p className="text-xs text-gray-500">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Joined{' '}
                        {format(new Date(member.joinedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isOwner && !member.isOwner ? (
                      <Select
                        value={member.role}
                        onValueChange={(newRole: 'owner' | 'member') =>
                          handleUpdateRole(member.id, newRole)
                        }
                        disabled={updatingRole === member.id}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant={
                          member.role === 'owner' ? 'default' : 'secondary'
                        }
                      >
                        {member.role}
                      </Badge>
                    )}

                    {isOwner && !member.isOwner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setMemberToRemove(member)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from organization
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {isOwner && pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Pending Invitations ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <div className="font-medium">{invitation.email}</div>
                      <p className="text-sm text-gray-600">
                        Invited by {invitation.invitedBy.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Expires{' '}
                        {format(new Date(invitation.expiresAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="text-orange-600 border-orange-200"
                    >
                      {invitation.role}
                    </Badge>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInvitationToCancel(invitation)}
                      disabled={canceling === invitation.id}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      {canceling === invitation.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={() => setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{memberToRemove?.name}</strong> from {organizationName}?
              They will lose access to all organization meetings and content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={removing === memberToRemove?.id}
              className="bg-red-600 hover:bg-red-700"
            >
              {removing === memberToRemove?.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Member'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invitation Confirmation Dialog */}
      <AlertDialog
        open={!!invitationToCancel}
        onOpenChange={() => setInvitationToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation to{' '}
              <strong>{invitationToCancel?.email}</strong>? They will no longer
              be able to join using this invitation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvitation}
              disabled={canceling === invitationToCancel?.id}
              className="bg-red-600 hover:bg-red-700"
            >
              {canceling === invitationToCancel?.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Canceling...
                </>
              ) : (
                'Cancel Invitation'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
