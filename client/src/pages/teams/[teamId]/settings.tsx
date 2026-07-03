import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/workspace-context';
import { useAuth } from '@/hooks/use-auth';
import { useTeamsStore } from '@/stores/teams-store';
import { TeamService } from '@/services/team-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import {
  Trash2,
  Users,
  Loader2,
  AlertCircle,
  UserPlus,
  Mail,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Team, TeamMember } from '@/types/team';
import SEO from '@/components/seo';
import { AddTeamMemberModal } from '@/components/teams/add-team-member-modal';
import { TeamInvitationModal } from '@/components/teams/team-invitation-modal';
import { TeamInvitationsList } from '@/components/teams/team-invitations-list';

export default function TeamSettings() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { activeOrganization, isPersonalMode } = useWorkspace();
  const { user } = useAuth();
  const { fetchTeams } = useTeamsStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  // Redirect if not in organization mode
  useEffect(() => {
    if (isPersonalMode || !activeOrganization) {
      navigate('/dashboard', { replace: true });
    }
  }, [isPersonalMode, activeOrganization, navigate]);

  // Load team data
  useEffect(() => {
    const loadTeam = async () => {
      if (!teamId || !activeOrganization?.id || isPersonalMode) return;

      try {
        setLoading(true);
        const teamData = await TeamService.getTeamById(
          activeOrganization.id,
          teamId
        );
        setTeam(teamData);
        setFormData({
          name: teamData.name || '',
          description: teamData.description || '',
        });
      } catch (error: any) {
        console.error('Error loading team:', error);
        if (error.response?.status === 403 || error.response?.status === 404) {
          setAccessDenied(true);
        } else {
          toast.error('Failed to load team details');
        }
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [teamId, activeOrganization?.id, isPersonalMode]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!teamId || !activeOrganization?.id) return;

    if (!formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    try {
      setSaving(true);
      const updatedTeam = await TeamService.updateTeam(
        activeOrganization.id,
        teamId,
        {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        }
      );
      setTeam(updatedTeam);
      toast.success('Team updated successfully');
      // Refresh teams list
      if (activeOrganization.id) {
        fetchTeams(activeOrganization.id);
      }
    } catch (error: any) {
      console.error('Error updating team:', error);
      toast.error(error.response?.data?.message || 'Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!teamId || !activeOrganization?.id) return;

    try {
      setDeleting(true);
      await TeamService.deleteTeam(activeOrganization.id, teamId);
      toast.success('Team deleted successfully');
      // Refresh teams list
      if (activeOrganization.id) {
        fetchTeams(activeOrganization.id);
      }
      // Navigate back to dashboard
      navigate('/members');
    } catch (error: any) {
      console.error('Error deleting team:', error);
      toast.error(error.response?.data?.message || 'Failed to delete team');
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!teamId || !activeOrganization?.id) return;

    try {
      setRemovingMember(userId);
      await TeamService.removeMemberFromTeam(
        activeOrganization.id,
        teamId,
        userId
      );
      // Reload team data
      const teamData = await TeamService.getTeamById(
        activeOrganization.id,
        teamId
      );
      setTeam(teamData);
      toast.success('Member removed successfully');
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast.error(error.response?.data?.message || 'Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  const handleMemberAdded = async () => {
    if (!teamId || !activeOrganization?.id) return;
    // Reload team data
    const teamData = await TeamService.getTeamById(
      activeOrganization.id,
      teamId
    );
    setTeam(teamData);
  };

  const handleInvitationSent = async () => {
    // Refresh invitations list will be handled by the component
    if (!teamId || !activeOrganization?.id) return;
    // Optionally reload team data
    const teamData = await TeamService.getTeamById(
      activeOrganization.id,
      teamId
    );
    setTeam(teamData);
  };

  const isOwner = team?.ownerId === user?.id;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (accessDenied || !team) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to view this team or the team doesn't
            exist.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <>
      <SEO title={`${team.name} - Settings`} />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your team details and members
            </p>
          </div>

          {/* Team Information */}
          <Card>
            <CardHeader>
              <CardTitle>Team Information</CardTitle>
              <CardDescription>
                Update your team's name and description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Team Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter team name"
                  disabled={!isOwner}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter team description"
                  rows={4}
                  disabled={!isOwner}
                />
              </div>
              {isOwner && (
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Members
                  </CardTitle>
                  <CardDescription>
                    Manage team members and their roles
                  </CardDescription>
                </div>
                {isOwner && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddMemberModalOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Member
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInviteModalOpen(true)}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Invite
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {team.members && team.members.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      {isOwner && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.members.map((member: TeamMember) => (
                      <TableRow key={member.userId}>
                        <TableCell className="font-medium">
                          {member.userName}
                        </TableCell>
                        <TableCell>{member.userEmail}</TableCell>
                        <TableCell>
                          {isOwner && member.role !== 'owner' ? (
                            <Select
                              value={member.role}
                              onValueChange={async () => {
                                // Note: Backend doesn't support updating team member roles yet
                                // This is UI-only for now
                                toast.info('Role update feature coming soon');
                                // TODO: Implement when backend endpoint is available
                                // await TeamService.updateMemberRole(
                                //   activeOrganization.id,
                                //   teamId,
                                //   member.userId,
                                //   newRole
                                // );
                              }}
                            >
                              <SelectTrigger className="w-24 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="capitalize">{member.role}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </TableCell>
                        {isOwner && (
                          <TableCell>
                            {member.role !== 'owner' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  handleRemoveMember(member.userId)
                                }
                                disabled={removingMember === member.userId}
                              >
                                {removingMember === member.userId ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Removing...
                                  </>
                                ) : (
                                  'Remove'
                                )}
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No members yet
                  </p>
                  {isOwner && (
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddMemberModalOpen(true)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Member
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInviteModalOpen(true)}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Invite Member
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {isOwner && activeOrganization?.id && (
            <TeamInvitationsList
              teamId={teamId!}
              organizationId={activeOrganization.id}
              onInvitationCancelled={handleInvitationSent}
            />
          )}

          {/* Danger Zone */}
          {isOwner && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Permanently delete this team. This action cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={deleting}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Team
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the team "{team.name}" and
                        all associated data. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleting}
                      >
                        {deleting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          'Delete Team'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add Member Modal */}
        {team && activeOrganization?.id && (
          <AddTeamMemberModal
            open={addMemberModalOpen}
            onOpenChange={setAddMemberModalOpen}
            teamId={teamId!}
            teamName={team.name}
            existingMemberIds={team.members?.map((m) => m.userId) || []}
            onMemberAdded={handleMemberAdded}
          />
        )}

        {/* Invite Member Modal */}
        {team && activeOrganization?.id && (
          <TeamInvitationModal
            open={inviteModalOpen}
            onOpenChange={setInviteModalOpen}
            teamId={teamId!}
            teamName={team.name}
            onInvitationSent={handleInvitationSent}
          />
        )}
      </DashboardLayout>
    </>
  );
}
