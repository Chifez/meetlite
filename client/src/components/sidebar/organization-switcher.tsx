'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
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
import { Building2, Plus, User, ChevronDown, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Organization {
  id: string;
  name: string;
  size?: string;
  industry?: string;
  logo?: string;
  members: any[];
}

interface OrganizationSwitcherProps {
  currentOrg: Organization | null;
  onOrgChange: (org: Organization | null) => void;
}

export function OrganizationSwitcher({
  currentOrg,
  onOrgChange,
}: OrganizationSwitcherProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load organizations from localStorage (mock data)
    const mockOrgs: Organization[] = [
      {
        id: 'org_1',
        name: 'Acme Corp',
        size: '51-200',
        industry: 'Technology',
        members: [],
      },
      {
        id: 'org_2',
        name: 'Design Studio',
        size: '1-10',
        industry: 'Design',
        members: [],
      },
    ];
    setOrganizations(mockOrgs);
  }, []);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Mock organization creation
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newOrg: Organization = {
      id: `org_${Date.now()}`,
      name: newOrgName,
      members: [],
    };

    setOrganizations((prev) => [...prev, newOrg]);
    setNewOrgName('');
    setIsCreateDialogOpen(false);
    setIsLoading(false);
    onOrgChange(newOrg);
  };

  const handleSwitchToPersonal = () => {
    onOrgChange(null);
  };

  const getCurrentDisplayName = () => {
    if (currentOrg) {
      return currentOrg.name;
    }
    return 'Personal Account';
  };

  const getCurrentDisplayIcon = () => {
    if (currentOrg) {
      return <Building2 className="w-4 h-4 text-primary" />;
    }
    return <User className="w-4 h-4 text-primary" />;
  };

  const getCurrentDisplayDescription = () => {
    if (currentOrg) {
      return `${currentOrg.members?.length || 0} members`;
    }
    return 'Individual workspace';
  };

  const getCurrentInitials = () => {
    if (currentOrg) {
      return currentOrg.name
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
          >
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getCurrentInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="text-left flex-1 min-w-0">
                <div className="font-medium text-sidebar-foreground truncate">
                  {getCurrentDisplayName()}
                </div>
                <div className="text-xs text-sidebar-foreground/60 truncate">
                  {getCurrentDisplayDescription()}
                </div>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-sidebar-foreground/60 flex-shrink-0" />
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
              onClick={() => onOrgChange(org)}
              className="flex items-center gap-3 p-3 cursor-pointer"
            >
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-medium">{org.name}</div>
                <div className="text-xs text-muted-foreground">
                  {org.members?.length || 0} members
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
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || !newOrgName}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isLoading ? 'Creating...' : 'Create Organization'}
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
