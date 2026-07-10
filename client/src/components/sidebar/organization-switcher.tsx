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
import {
  Building2,
  Plus,
  User,
  Loader2,
  ChevronsUpDown,
  Zap,
  Check,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorkspace } from '@/contexts/workspace-context';
import { useCurrentPlan } from '@/hooks/use-current-plan';
import PlanSettingsDialog from '@/components/plan/plan-settings-dialog';
import { toast } from 'sonner';

interface OrganizationSwitcherProps {
  collapsed?: boolean;
}

export function OrganizationSwitcher({ collapsed = false }: OrganizationSwitcherProps) {
  const {
    activeOrganization,
    organizations,
    switchingOrg,
    switchToOrganization,
    switchToPersonal,
    createOrganization,
    currentWorkspaceName,
  } = useWorkspace();
  const { currentPlan } = useCurrentPlan();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [newOrgIndustry, setNewOrgIndustry] = useState('');
  const [newOrgSize, setNewOrgSize] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isFreePlan = currentPlan === 'free';

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isFreePlan) {
      toast.error('Organization creation requires a paid plan. Please upgrade to continue.');
      setIsCreateDialogOpen(false);
      setIsPlanDialogOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      const newOrg = await createOrganization({
        name: newOrgName.trim(),
        description: newOrgDescription.trim() || undefined,
        industry: newOrgIndustry.trim() || undefined,
        size: newOrgSize || undefined,
      });

      if (newOrg) {
        setNewOrgName('');
        setNewOrgDescription('');
        setNewOrgIndustry('');
        setNewOrgSize('');
        setIsCreateDialogOpen(false);
      }
    } catch (error: any) {
      if (error?.response?.data?.upgradeRequired) {
        toast.error(error.response.data.message || 'Please upgrade to create organizations');
        setIsCreateDialogOpen(false);
        setIsPlanDialogOpen(true);
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
      return `${activeOrganization.memberCount || 0} member${activeOrganization.memberCount === 1 ? '' : 's'
        }`;
    }
    return 'Individual workspace';
  };

  const getCurrentInitials = () => {
    if (activeOrganization) {
      return activeOrganization.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'PA';
  };

  return (
    <div className="space-y-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <Button
              variant="ghost"
              className="h-10 w-10 p-0 rounded-xl hover:bg-sidebar-accent flex items-center justify-center border border-border/20 transition-all duration-200"
              disabled={switchingOrg}
              aria-label="Switch workspace"
            >
              {switchingOrg ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Avatar className="h-8 w-8 rounded-lg">
                  {activeOrganization?.logo && <AvatarImage src={activeOrganization.logo} alt={activeOrganization.name} className="object-cover" />}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold rounded-lg">
                    {getCurrentInitials()}
                  </AvatarFallback>
                </Avatar>
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-between h-auto p-2 bg-muted/30 border border-border/60 hover:bg-sidebar-accent rounded-xl transition-all duration-200"
              disabled={switchingOrg}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <Avatar className="h-8 w-8 rounded-lg flex-shrink-0">
                  {activeOrganization?.logo && <AvatarImage src={activeOrganization.logo} alt={activeOrganization.name} className="object-cover" />}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold rounded-lg border border-primary/20">
                    {getCurrentInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">
                    {getCurrentDisplayName()}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate font-medium">
                    {getCurrentDisplayDescription()}
                  </div>
                </div>
              </div>
              {switchingOrg ? (
                <Loader2 className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0 animate-spin" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0 ml-1" />
              )}
            </Button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={collapsed ? "center" : "start"}
          side={collapsed ? "right" : "bottom"}
          className="w-60 border border-border/80 bg-popover/95 backdrop-blur-md rounded-2xl shadow-xl p-1.5 z-[100]"
        >
          {/* Personal Account Option */}
          <DropdownMenuItem
            onClick={handleSwitchToPersonal}
            className="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-sidebar-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-foreground">Personal Account</div>
                <div className="text-[10px] text-muted-foreground">Individual meetings</div>
              </div>
            </div>
            {!activeOrganization && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5" />

          {/* Organizations List */}
          <div className="max-h-48 overflow-y-auto scrollbar-hide space-y-0.5">
            {organizations.map((org) => {
              const isSelected = activeOrganization?.id === org.id;
              return (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSwitchToOrg(org.id)}
                  className="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-sidebar-accent transition-colors"
                  disabled={switchingOrg}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold text-foreground">{org.name}</div>
                      <div className="text-[10px] text-muted-foreground font-medium">
                        {org.memberCount || 0} members • {org.plan?.type.toUpperCase() || 'FREE'}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </div>

          <DropdownMenuSeparator className="my-1.5" />

          {/* Create New Organization */}
          {isFreePlan ? (
            <DropdownMenuItem
              className="flex items-center gap-3 p-2 cursor-pointer border border-dashed border-border/80 rounded-xl m-1 opacity-70 hover:opacity-100 transition-opacity"
              onSelect={(e) => {
                e.preventDefault();
                setIsPlanDialogOpen(true);
                toast.info('Organization creation requires a paid plan. Upgrade to continue.');
              }}
            >
              <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-muted-foreground">Create Organization</div>
                <div className="text-[10px] text-primary font-bold">Upgrade required</div>
              </div>
            </DropdownMenuItem>
          ) : (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem
                  className="flex items-center gap-3 p-2 cursor-pointer border border-dashed border-border/80 rounded-xl m-1 hover:border-primary/50"
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-muted-foreground">Create Organization</div>
                    <div className="text-[10px] text-muted-foreground">Start a new team</div>
                  </div>
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="border border-border/80 bg-zinc-950/90 backdrop-blur-xl rounded-2xl shadow-2xl p-6">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-foreground">Create New Organization</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Set up a new organization to collaborate with your team.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateOrganization} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="orgName" className="text-xs font-semibold">Organization Name</Label>
                    <Input
                      id="orgName"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Enter organization name"
                      required
                      className="bg-muted/30 border-border/60 focus:border-primary rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orgDescription" className="text-xs font-semibold">Description (optional)</Label>
                    <Input
                      id="orgDescription"
                      value={newOrgDescription}
                      onChange={(e) => setNewOrgDescription(e.target.value)}
                      placeholder="What does your organization do?"
                      className="bg-muted/30 border-border/60 focus:border-primary rounded-xl"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      disabled={isLoading}
                      className="rounded-xl border-border/60 hover:bg-muted"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading || !newOrgName.trim()}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
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
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <PlanSettingsDialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen} />
    </div>
  );
}
