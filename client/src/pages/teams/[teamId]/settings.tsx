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
  UserX,
} from 'lucide-react';
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

  useEffect(() => {
    if (isPersonalMode || !activeOrganization) {
      navigate('/dashboard', { replace: true });
    }
  }, [isPersonalMode, activeOrganization, navigate]);

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
        console.error('Failed to load team:', error);
        setAccessDenied(true);
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

    setSaving(true);
    try {
      const updatedTeam = await TeamService.updateTeam(
        activeOrganization.id,
        teamId,
        formData
      );
      setTeam(updatedTeam);
      toast.success('Team settings updated successfully');
      await fetchTeams(activeOrganization.id);
    } catch (error: any) {
      console.error('Failed to update team:', error);
      toast.error(error.message || 'Failed to update team settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!teamId || !activeOrganization?.id) return;

    setDeleting(true);
    try {
      await TeamService.deleteTeam(activeOrganization.id, teamId);
      toast.success('Team deleted successfully');
      await fetchTeams(activeOrganization.id);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Failed to delete team:', error);
      toast.error(error.message || 'Failed to delete team');
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!teamId || !activeOrganization?.id) return;

    setRemovingMember(memberId);
    try {
      await TeamService.removeMember(activeOrganization.id, teamId, memberId);
      toast.success('Member removed from team');
      
      const teamData = await TeamService.getTeamById(
        activeOrganization.id,
        teamId
      );
      setTeam(teamData);
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      toast.error(error.message || 'Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  const handleMemberAdded = async () => {
    if (!teamId || !activeOrganization?.id) return;
    try {
      const teamData = await TeamService.getTeamById(
        activeOrganization.id,
        teamId
      );
      setTeam(teamData);
    } catch (error) {
      console.error('Failed to reload team after member added:', error);
    }
  };

  const handleInvitationSent = async () => {
    if (!teamId || !activeOrganization?.id) return;
    try {
      const teamData = await TeamService.getTeamById(
        activeOrganization.id,
        teamId
      );
      setTeam(teamData);
    } catch (error) {
      console.error('Failed to reload team after invitation:', error);
    }
  };

  const isOwner = team?.role === 'owner';

  // ── LOADING STATE ──────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <SEO title="Loading Settings · MeetLite" />
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-[0.875rem] text-muted-foreground">Loading team settings…</p>
        </div>
      </DashboardLayout>
    );
  }

  // ── ACCESS DENIED STATE ────────────────────────────────────────
  if (accessDenied || !team) {
    return (
      <DashboardLayout>
        <SEO title="Access Denied · MeetLite" />
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border border-border rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-[0.9375rem] font-semibold text-foreground tracking-[-0.01em] mb-1">
              Access denied
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground max-w-xs">
              You don't have permission to manage settings for this team, or it does not exist.
            </p>
          </div>
          <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">
            Back to dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // ── POPULATED STATE ────────────────────────────────────────────
  return (
    <DashboardLayout>
      <SEO title={`Team Settings · ${team.name} · MeetLite`} />

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-[1.25rem] font-bold text-foreground tracking-[-0.025em]">
          Team Settings
        </h1>
        <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
          Manage team information, members, and invitations for @{team.name}.
        </p>
      </div>

      <div className="space-y-6">
        {/* Team Information */}
        <Card>
          <CardHeader>
            <CardTitle>Team Information</CardTitle>
            <CardDescription>
              Update your team's name and description.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your team's focus"
                rows={3}
                disabled={!isOwner}
              />
            </div>
            {isOwner && (
              <div className="flex justify-end pt-1">
                <Button id="team-settings-save-btn" onClick={handleSave} disabled={saving} className="rounded-xl font-semibold px-6">
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4.5 w-4.5 text-primary" />
                  Team Members
                </CardTitle>
                <CardDescription>
                  Manage members assigned to this team workspace.
                </CardDescription>
              </div>
              {isOwner && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddMemberModalOpen(true)}
                    className="gap-1.5 rounded-xl"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInviteModalOpen(true)}
                    className="gap-1.5 rounded-xl"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Invite
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {team.members && team.members.length > 0 ? (
              <div className="border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      {isOwner && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.members.map((member: TeamMember) => (
                      <TableRow key={member.userId}>
                        <TableCell className="font-semibold text-foreground">
                          {member.userName}
                        </TableCell>
                        <TableCell>{member.userEmail}</TableCell>
                        <TableCell>
                          {isOwner && member.role !== 'owner' ? (
                            <Select
                              value={member.role}
                              onValueChange={() => {
                                toast.info('Role updates are coming soon.');
                              }}
                            >
                              <SelectTrigger className="w-24 h-8 text-[0.8125rem] rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="capitalize text-[0.8125rem] font-medium">{member.role}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[0.8125rem]">
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </TableCell>
                        {isOwner && (
                          <TableCell className="text-right">
                            {member.role !== 'owner' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveMember(member.userId)}
                                disabled={removingMember === member.userId}
                                className="rounded-lg h-7.5 text-[0.75rem] px-2.5"
                              >
                                {removingMember === member.userId ? 'Removing...' : 'Remove'}
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
                <Users className="h-10 w-10 text-muted-foreground/60" />
                <div>
                  <p className="text-[0.875rem] font-semibold text-foreground">No members in team</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add members directly or invite them via email.
                  </p>
                </div>
                {isOwner && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddMemberModalOpen(true)}
                      className="gap-1.5"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Add member
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInviteModalOpen(true)}
                      className="gap-1.5"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Invite member
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
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Permanently delete this team. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 border border-destructive/20 rounded-xl bg-destructive/3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-destructive mb-1">
                      Delete Team
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Permanently delete this team and remove access for all assigned members.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button id="delete-team-btn" variant="destructive" size="sm" className="sm:ml-4 rounded-xl flex-shrink-0" disabled={deleting}>
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Delete team
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the team "{team.name}" and all associated data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                          disabled={deleting}
                        >
                          {deleting ? 'Deleting...' : 'Delete team'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
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
  );
}
