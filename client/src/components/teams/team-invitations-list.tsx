import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, X, Clock } from 'lucide-react';
import { TeamInvitationService } from '@/services/team-invitation-service';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { TeamInvitation } from '@/types/team-invitation';
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

interface TeamInvitationsListProps {
  teamId: string;
  organizationId: string;
  onInvitationCancelled: () => void;
}

export const TeamInvitationsList: React.FC<TeamInvitationsListProps> = ({
  teamId,
  organizationId,
  onInvitationCancelled,
}) => {
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [invitationToCancel, setInvitationToCancel] =
    useState<TeamInvitation | null>(null);

  useEffect(() => {
    loadInvitations();
  }, [teamId, organizationId]);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const teamInvitations =
        await TeamInvitationService.getPendingInvitationsByTeam(
          organizationId,
          teamId
        );
      // Filter to only pending invitations
      const pendingInvitations = teamInvitations.filter(
        (inv) => inv.status === 'pending'
      );
      setInvitations(pendingInvitations);
    } catch (error: any) {
      console.error('Error loading team invitations:', error);
      // Silently fail - endpoint might not exist yet
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvitation = async () => {
    if (!invitationToCancel) return;

    try {
      setCanceling(invitationToCancel.id);
      await TeamInvitationService.cancelInvitation(
        organizationId,
        teamId,
        invitationToCancel.id
      );
      toast.success('Invitation cancelled successfully');
      setInvitationToCancel(null);
      loadInvitations();
      onInvitationCancelled();
    } catch (error: any) {
      console.error('Error cancelling invitation:', error);
      toast.error(
        error.response?.data?.message || 'Failed to cancel invitation'
      );
    } finally {
      setCanceling(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return null; // Don't show section if no invitations
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Pending Invitations ({invitations.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="p-4 flex items-center justify-between hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">
                      {invitation.invitedUserName || invitation.invitedUserId}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {invitation.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Invited by{' '}
                      {invitation.inviterName ||
                        invitation.invitedByName ||
                        'Unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires{' '}
                      {format(new Date(invitation.expiresAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
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
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cancel Invitation Confirmation Dialog */}
      <AlertDialog
        open={!!invitationToCancel}
        onOpenChange={(open) => {
          if (!open && canceling !== invitationToCancel?.id) {
            setInvitationToCancel(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation to{' '}
              <strong>
                {invitationToCancel?.invitedUserName ||
                  invitationToCancel?.invitedUserId}
              </strong>
              ? They will no longer be able to join using this invitation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling === invitationToCancel?.id}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvitation}
              disabled={canceling === invitationToCancel?.id}
              className="bg-red-600 hover:bg-red-700"
            >
              {canceling === invitationToCancel?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Canceling...
                </>
              ) : (
                'Cancel Invitation'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
