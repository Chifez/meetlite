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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
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
    );
  }

  if (!members) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold mb-2">
                Failed to Load Members
              </h3>
              <p className="text-gray-600 mb-4">
                We couldn't load the member list for this organization.
              </p>
              <Button onClick={() => fetchMembers(activeOrganization.id)}>
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 mb-6 text-sm text-gray-600">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-2 p-0 h-auto font-normal"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <span>/</span>
          <span>Members</span>
        </div>

        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {activeOrganization.name} Members
            </h1>
            <p className="text-gray-600">
              Manage team members and invitations for your organization
            </p>
          </div>
        </div>

        {/* Permission Notice for Non-Owners */}
        {!isOwner && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Member View
                  </p>
                  <p className="text-sm text-blue-700">
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
      </div>
    </div>
  );
};

export default MembersPage;
