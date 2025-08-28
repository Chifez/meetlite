import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../contexts/workspace-context';
import { useAuth } from '../hooks/useAuth';
import { useMembers } from '../hooks/useMembers';
import { MemberList } from '../components/organization/member-list';
import { InviteMemberModal } from '../components/organization/invite-member-modal';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { Users, ArrowLeft, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/dashboard-layout';

const MembersPage: React.FC = () => {
  const { user } = useAuth();
  const { activeOrganization, isPersonalMode } = useWorkspace();
  const { members, loading, fetchMembers } = useMembers();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const navigate = useNavigate();

  // Redirect if not in organization mode
  useEffect(() => {
    if (isPersonalMode || !activeOrganization) {
      navigate('/dashboard');
    }
  }, [isPersonalMode, activeOrganization, navigate]);

  // Fetch members when organization changes
  useEffect(() => {
    if (activeOrganization?.id) {
      fetchMembers(activeOrganization.id);
    }
  }, [activeOrganization?.id, fetchMembers]);

  if (isPersonalMode || !activeOrganization) {
    return null; // Will redirect via useEffect
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-20 md:pt-24">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="space-y-6">
            {/* Header Skeleton */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-6" />
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>

            {/* Content Skeleton */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!members) {
    return (
      <div className="min-h-screen bg-background pt-20 md:pt-24">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold mb-2">
                Failed to Load Members
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                We couldn't load the member list for this organization.
              </p>
              <Button
                size="sm"
                onClick={() => fetchMembers(activeOrganization.id)}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const userRole = members.userRole;
  const isOwner = userRole === 'owner';

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <Users className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-foreground capitalize">
            {activeOrganization.name} members
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage team members and invitations for your organization
          </p>
        </div>
      </div>

      {/* Permission Notice for Non-Owners */}
      {!isOwner && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs font-medium text-blue-900">Member View</p>
                <p className="text-xs text-blue-700">
                  You can view team members but only organization owners can
                  invite or remove members.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Member List */}
      <MemberList
        organizationId={activeOrganization.id}
        organizationName={activeOrganization.name}
        members={members.members}
        pendingInvitations={members.pendingInvitations}
        userRole={userRole}
        memberCount={members.organization.memberCount}
        maxMembers={members.organization.maxMembers}
        onInviteClick={() => setInviteModalOpen(true)}
      />

      {/* Invite Member Modal */}
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
