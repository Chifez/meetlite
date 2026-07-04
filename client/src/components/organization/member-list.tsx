import React, { useState } from 'react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useCanInviteMembers, useIsOwner } from '@/hooks/use-permissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Plus,
} from 'lucide-react';
import { useMembers } from '@/hooks/use-members';
import { TeamAssignmentDropdown } from './team-assignment-dropdown';
import { useCurrentPlan } from '@/hooks/use-current-plan';
import type {
  OrganizationMember,
  PendingInvitation,
} from '@/services/member-service';

interface MemberListProps {
  organizationId: string;
  organizationName: string;
  members: OrganizationMember[];
  pendingInvitations: PendingInvitation[];
  userRole: 'owner' | 'admin' | 'member';
  memberCount: number;
  maxMembers: number;
  onInviteClick: () => void;
  onRefresh?: () => void;
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
  onRefresh,
}) => {
  const {
    removeMember,
    cancelInvitation,
    updateMemberRole,
    removing,
    canceling,
    updatingRole,
    fetchMembers,
  } = useMembers();
  const { currentPlan } = useCurrentPlan();
  const isFreePlan = currentPlan === 'free';
  const showTeams = !isFreePlan;
  const [memberToRemove, setMemberToRemove] =
    useState<OrganizationMember | null>(null);
  const [invitationToCancel, setInvitationToCancel] =
    useState<PendingInvitation | null>(null);

  const isOwner = useIsOwner();

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    const success = await removeMember(
      organizationId,
      memberToRemove.id,
      memberToRemove.name
    );
    if (success) {
      setMemberToRemove(null);
      onRefresh?.();
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
      onRefresh?.();
    }
  };

  const handleUpdateRole = async (
    memberId: string,
    newRole: 'owner' | 'admin' | 'member'
  ) => {
    await updateMemberRole(organizationId, memberId, newRole);
    onRefresh?.();
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
      {/* Active Members Table */}
      <Card>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Users className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-semibold text-foreground">No active members</p>
              <p className="text-xs text-muted-foreground">Invite members to collaborate in this workspace.</p>
            </div>
          ) : (
            <div className="border border-border rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="pl-4.5">Member</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    {(isOwner || userRole === 'admin') && <TableHead className="w-[50px] pr-4.5"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      {/* Member Info column */}
                      <TableCell className="pl-4.5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground truncate text-[0.875rem]">
                                {member.name}
                              </span>
                              {member.isOwner && (
                                <Crown className="h-3.5 w-3.5 text-amber-500" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Teams column */}
                      <TableCell className="py-3">
                        {showTeams ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {member.teams && member.teams.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {member.teams.map((team) => (
                                  <Badge
                                    key={team.teamId}
                                    variant="secondary"
                                    className="text-[0.6875rem] px-2 py-0 h-5"
                                  >
                                    @{team.teamName}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No teams</span>
                            )}
                            {(isOwner || userRole === 'admin') && (
                              <TeamAssignmentDropdown
                                memberId={member.id}
                                memberName={member.name}
                                currentTeams={member.teams?.map((t) => t.teamId) || []}
                                onTeamChange={async () => {
                                  await fetchMembers(organizationId);
                                  onRefresh?.();
                                }}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </TeamAssignmentDropdown>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Role column */}
                      <TableCell className="py-3">
                        {(isOwner || userRole === 'admin') && !member.isOwner ? (
                          <Select
                            value={member.role}
                            onValueChange={(newRole: 'owner' | 'admin' | 'member') =>
                              handleUpdateRole(member.id, newRole)
                            }
                            disabled={updatingRole === member.id}
                          >
                            <SelectTrigger className="w-24 h-8 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="owner">Owner</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="solid" className="bg-muted text-foreground hover:bg-muted font-medium text-xs py-0.5 px-2">
                            {member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : 'Member'}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Joined Date column */}
                      <TableCell className="py-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/75" />
                          {format(new Date(member.joinedAt), 'MMM d, yyyy')}
                        </div>
                      </TableCell>

                      {/* Actions column */}
                      {(isOwner || userRole === 'admin') && (
                        <TableCell className="text-right pr-4.5 py-3">
                          {isOwner && !member.isOwner && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem
                                  onClick={() => setMemberToRemove(member)}
                                  className="text-destructive focus:text-destructive cursor-pointer gap-2 font-medium"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remove from workspace
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations Table */}
      {isOwner && pendingInvitations.length > 0 && (
        <Card className="border border-border">
          <div className="p-4 border-b border-border bg-muted/10">
            <h3 className="text-[0.875rem] font-bold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Invitations ({pendingInvitations.length})
            </h3>
          </div>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="pl-4.5">Invited Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Inviter</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-[50px] pr-4.5 text-right">Cancel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="pl-4.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Mail className="h-3.5 w-3.5 text-amber-600" />
                          </div>
                          <span className="font-semibold text-foreground text-[0.875rem]">
                            {invitation.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className="text-[0.6875rem] font-semibold text-amber-600 border-amber-200 bg-amber-50/50 capitalize px-2 h-5">
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground">
                        {invitation.invitedBy.name}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground">
                        {format(new Date(invitation.expiresAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right pr-4.5 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInvitationToCancel(invitation)}
                          disabled={canceling === invitation.id}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive rounded-lg"
                        >
                          {canceling === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => {
          if (!open && removing !== memberToRemove?.id) {
            setMemberToRemove(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToRemove?.name}</strong> from {organizationName}?
              They will lose access to all organization meetings and content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing === memberToRemove?.id} className="rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={removing === memberToRemove?.id}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl"
            >
              {removing === memberToRemove?.id ? 'Removing...' : 'Remove Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invitation Confirmation Dialog */}
      <AlertDialog
        open={!!invitationToCancel}
        onOpenChange={(open) => {
          if (!open && canceling !== invitationToCancel?.id) {
            setInvitationToCancel(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation sent to <strong>{invitationToCancel?.email}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling === invitationToCancel?.id} className="rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvitation}
              disabled={canceling === invitationToCancel?.id}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl"
            >
              {canceling === invitationToCancel?.id ? 'Canceling...' : 'Cancel Invitation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
