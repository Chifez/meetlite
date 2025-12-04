import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, Loader2, Plus } from 'lucide-react';
import { useTeams } from '@/hooks/use-teams';
import { useWorkspace } from '@/contexts/workspace-context';
import { TeamAssignmentDropdown } from './team-assignment-dropdown';
import { CreateTeamModal } from './create-team-modal';
import type { OrganizationMember } from '@/services/member-service';

interface TeamAssignmentPanelProps {
  organizationId: string;
  members: OrganizationMember[];
  onRefresh: () => void;
}

export const TeamAssignmentPanel: React.FC<TeamAssignmentPanelProps> = ({
  organizationId,
  members,
  onRefresh,
}) => {
  const { activeOrganization } = useWorkspace();
  const { teams, loading, fetchTeams } = useTeams();
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);

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
            Create teams and assign members to collaborate
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
        <div className="space-y-6">
          {teams.map((team) => {
            const teamMembers = members.filter((member) =>
              member.teams?.some((t) => t.teamId === team.id)
            );
            const nonTeamMembers = members.filter(
              (member) => !member.teams?.some((t) => t.teamId === team.id)
            );

            return (
              <Card key={team.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">@{team.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {teamMembers.length} of {members.length} members
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {team.memberCount || teamMembers.length} members
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Team Members */}
                  {teamMembers.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                        Team Members
                      </h4>
                      <div className="space-y-2">
                        {teamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {member.name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">
                                  {member.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {member.email}
                                </p>
                              </div>
                            </div>
                            <TeamAssignmentDropdown
                              memberId={member.id}
                              memberName={member.name}
                              currentTeams={
                                member.teams?.map((t) => t.teamId) || []
                              }
                              onTeamChange={onRefresh}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Available Members to Add */}
                  {nonTeamMembers.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                        Add Members
                      </h4>
                      <div className="space-y-2">
                        {nonTeamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                  {member.name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">
                                  {member.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {member.email}
                                </p>
                              </div>
                            </div>
                            <TeamAssignmentDropdown
                              memberId={member.id}
                              memberName={member.name}
                              currentTeams={
                                member.teams?.map((t) => t.teamId) || []
                              }
                              onTeamChange={onRefresh}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {teamMembers.length === 0 && nonTeamMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No members available
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
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
