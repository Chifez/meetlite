import React, { useEffect, useState } from 'react';
import { useWorkspace } from '@/contexts/workspace-context';
import { useMembers } from '@/hooks/use-members';
import { useCurrentPlan } from '@/hooks/use-current-plan';
import { MemberList } from '@/components/organization/member-list';
import { InviteMemberModal } from '@/components/organization/invite-member-modal';
import { TeamAssignmentPanel } from '@/components/organization/team-assignment-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, AlertCircle, UserPlus, UsersRound, RefreshCcw, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import SEO from '@/components/seo';

const MembersPage: React.FC = () => {
  const { activeOrganization, isPersonalMode } = useWorkspace();
  const { members, loading, fetchMembers } = useMembers();
  const { currentPlan } = useCurrentPlan();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('members');
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const navigate = useNavigate();
  const isFreePlan = currentPlan === 'free';
  const showTeamsTab = !isFreePlan;

  useEffect(() => {
    if (isPersonalMode || !activeOrganization) {
      navigate('/dashboard');
    }
  }, [isPersonalMode, activeOrganization, navigate]);

  useEffect(() => {
    if (activeOrganization?.id) {
      setHasAttemptedLoad(true);
      fetchMembers(activeOrganization.id);
    }
  }, [activeOrganization?.id, fetchMembers]);

  if (isPersonalMode || !activeOrganization) {
    return null;
  }

  // ── LOADING STATE ──────────────────────────────────────────────
  if (loading || !hasAttemptedLoad) {
    return (
      <DashboardLayout>
        <SEO title="Members · MeetLite" />
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>

        {/* Row skeletons */}
        <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <Skeleton className="w-9 h-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  // ── ERROR STATE ────────────────────────────────────────────────
  if (!members && hasAttemptedLoad && !loading) {
    return (
      <DashboardLayout>
        <SEO title="Members · MeetLite" />
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-[0.9375rem] font-semibold text-foreground tracking-[-0.01em] mb-1">
              Failed to load members
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground max-w-xs">
              We couldn't retrieve the member list for this workspace. Check your connection and try again.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchMembers(activeOrganization.id)}
            className="gap-1.5"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!members) return null;

  const userRole = members.userRole;
  const isOwner = userRole === 'owner';

  // ── POPULATED STATE ────────────────────────────────────────────
  return (
    <DashboardLayout>
      <SEO title={`Members · ${activeOrganization.name} · MeetLite`} />

      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.25rem] font-bold text-foreground tracking-[-0.025em]">
            Team members
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
            {members.organization.memberCount} of {members.organization.maxMembers} seats used
            in {activeOrganization.name}
          </p>
        </div>
        {isOwner && (
          <Button
            id="invite-member-btn"
            size="sm"
            onClick={() => setInviteModalOpen(true)}
            className="gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite member
          </Button>
        )}
      </div>

      {/* Read-only notice for non-owners */}
      {!isOwner && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[0.8125rem] font-semibold text-foreground">
              View-only access
            </p>
            <p className="text-[0.75rem] text-muted-foreground mt-0.5">
              Only workspace owners can invite or remove members.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Members
          </TabsTrigger>
          {showTeamsTab && (
            <TabsTrigger value="teams" className="gap-1.5">
              <UsersRound className="w-3.5 h-3.5" />
              Teams
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="members">
          <MemberList
            organizationId={activeOrganization.id}
            organizationName={activeOrganization.name}
            members={members.members}
            pendingInvitations={members.pendingInvitations}
            userRole={userRole}
            memberCount={members.organization.memberCount}
            maxMembers={members.organization.maxMembers}
            onInviteClick={() => setInviteModalOpen(true)}
            onRefresh={() => fetchMembers(activeOrganization.id)}
          />
        </TabsContent>

        {showTeamsTab && (
          <TabsContent value="teams">
            <TeamAssignmentPanel
              organizationId={activeOrganization.id}
              members={members.members}
              onRefresh={() => fetchMembers(activeOrganization.id)}
            />
          </TabsContent>
        )}
      </Tabs>

      <InviteMemberModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        organizationId={activeOrganization.id}
        organizationName={activeOrganization.name}
        canInviteOwners={isOwner}
      />
    </DashboardLayout>
  );
};

export default MembersPage;
