'use client';

import type React from 'react';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Plus, User, Loader2, ChevronsUpDown } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useWorkspace } from '@/contexts/workspace-context';

interface OrganizationSwitcherProps {
  // Props are no longer needed as we get data from context
}

export function OrganizationSwitcher({}: OrganizationSwitcherProps) {
  const {
    activeOrganization,
    organizations,
    switchingOrg,
    switchToOrganization,
    switchToPersonal,
    createOrganization,
    currentWorkspaceName,
  } = useWorkspace();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [newOrgIndustry, setNewOrgIndustry] = useState('');
  const [newOrgSize, setNewOrgSize] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const newOrg = await createOrganization({
        name: newOrgName.trim(),
        description: newOrgDescription.trim() || undefined,
        industry: newOrgIndustry.trim() || undefined,
        size: newOrgSize || undefined,
      });

      if (newOrg) {
        // Reset form and close dialog
        setNewOrgName('');
        setNewOrgDescription('');
        setNewOrgIndustry('');
        setNewOrgSize('');
        setIsCreateDialogOpen(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchToPersonal = () => {
    if (switchingOrg) return;
    switchToPersonal();
  };

  const handleSwitchToOrg = (orgId: string) => {
    if (switchingOrg) return;

    switchToOrganization(orgId);
  };

  const getCurrentDisplayName = (): string => {
    return currentWorkspaceName;
  };

  const getCurrentDisplayDescription = (): string => {
    if (activeOrganization) {
      return `${activeOrganization.memberCount || 0} member${
        activeOrganization.memberCount === 1 ? '' : 's'
      }`;
    }
    return 'Individual workspace';
  };

  const getCurrentInitials = () => {
    if (activeOrganization) {
      return activeOrganization.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'PA'; // Personal Account
  };

  return (
    <div className="space-y-2">
      {/* Current Organization/Personal Display - Clickable Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-auto p-3 hover:bg-sidebar-accent"
            disabled={switchingOrg}
          >
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getCurrentInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="text-left flex-1 min-w-0">
                <div className="text-xs font-medium text-sidebar-foreground truncate uppercase">
                  {getCurrentDisplayName()}
                </div>
                <div className="text-xs text-sidebar-foreground/60 truncate">
                  {getCurrentDisplayDescription()}
                </div>
              </div>
            </div>
            {switchingOrg ? (
              <Loader2 className="h-4 w-4 text-sidebar-foreground/60 flex-shrink-0 animate-spin" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 text-sidebar-foreground/60 flex-shrink-0" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-full">
          {/* Personal Account Option */}
          <DropdownMenuItem
            onClick={handleSwitchToPersonal}
            className="flex items-center gap-3 p-3 cursor-pointer"
          >
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left">
              <div className="font-medium">Personal Account</div>
              <div className="text-xs text-muted-foreground">
                Individual meetings
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Organizations List */}
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSwitchToOrg(org.id)}
              className="flex items-center gap-3 p-3 cursor-pointer"
              disabled={switchingOrg}
            >
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-medium">{org.name}</div>
                <div className="text-xs text-muted-foreground">
                  {org.memberCount || 0} members • {org.plan?.type || 'free'}
                </div>
              </div>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {/* Create New Organization */}
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <DropdownMenuItem
                className="flex items-center gap-3 p-3 cursor-pointer border-2 border-dashed border-border rounded-lg m-2"
                onSelect={(e) => e.preventDefault()}
              >
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-muted-foreground">
                    Create Organization
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Start a new team
                  </div>
                </div>
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Set up a new organization to collaborate with your team.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateOrganization} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Enter organization name"
                    required
                    className="bg-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgDescription">Description (optional)</Label>
                  <Input
                    id="orgDescription"
                    value={newOrgDescription}
                    onChange={(e) => setNewOrgDescription(e.target.value)}
                    placeholder="What does your organization do?"
                    className="bg-input"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || !newOrgName.trim()}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Organization'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
