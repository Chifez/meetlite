import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Loader2, Plus, Settings, ChevronRight } from 'lucide-react';
import { useTeamsStore } from '@/stores/teams-store';
import { useWorkspace } from '@/contexts/workspace-context';
import { TeamAssignmentDropdown } from './team-assignment-dropdown';
import { CreateTeamModal } from './create-team-modal';
import { useNavigate } from 'react-router-dom';
import type { OrganizationMember } from '@/services/member-service';

interface TeamAssignmentPanelProps {
  organizationId: string;
  members: OrganizationMember[];
  onRefresh: () => void;
}

export const TeamAssignmentPanel: React.FC<TeamAssignmentPanelProps> = ({
  organizationId: _organizationId,
  members,
  onRefresh,
}) => {
  const { activeOrganization } = useWorkspace();
  const { teams, loading, fetchTeams } = useTeamsStore();
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (activeOrganization?.id) {
      fetchTeams(activeOrganization.id);
    }
  }, [activeOrganization?.id, fetchTeams]);

  const handleTeamCreated = () => {
    if (activeOrganization?.id) {
      fetchTeams(activeOrganization.id);
    }
  };

  const getTeamMemberCount = (teamId: string) => {
    return members.filter((member) =>
      member.teams?.some((t) => t.teamId === teamId)
    ).length;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Team Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Teams</h2>
          <p className="text-sm text-muted-foreground">
            Manage teams and assign members to collaborate
          </p>
        </div>
        <Button onClick={() => setCreateTeamModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Team
        </Button>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-muted-foreground mb-4">
              No teams yet. Create your first team to get started.
            </p>
            <Button
              onClick={() => setCreateTeamModalOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => {
            const memberCount = getTeamMemberCount(team.id);

            return (
              <Card
                key={team.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/teams/${team.id}/settings`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          @{team.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {memberCount}{' '}
                          {memberCount === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/teams/${team.id}/settings`);
                      }}
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Members Quick Assignment Section */}
      {teams.length > 0 && members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Assignment</CardTitle>
            <p className="text-sm text-muted-foreground">
              Assign members to teams from the list below
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {members.map((member) => {
                const memberTeams = member.teams || [];
                const teamCount = memberTeams.length;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </p>
                      </div>
                      {teamCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {teamCount} {teamCount === 1 ? 'team' : 'teams'}
                        </Badge>
                      )}
                    </div>
                    <TeamAssignmentDropdown
                      memberId={member.id}
                      memberName={member.name}
                      currentTeams={memberTeams.map((t) => t.teamId)}
                      onTeamChange={onRefresh}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Team Modal */}
      <CreateTeamModal
        open={createTeamModalOpen}
        onOpenChange={setCreateTeamModalOpen}
        onTeamCreated={handleTeamCreated}
      />
    </div>
  );
};
