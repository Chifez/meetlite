import { useState } from 'react';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { OrganizationService } from '@/services/organization-service';

interface OrganizationDangerZoneProps {
  organization?: any;
  activeOrganization: any;
}

export default function OrganizationDangerZone({
  activeOrganization,
}: OrganizationDangerZoneProps) {
  const { refreshOrganizations } = useWorkspace();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteOrganization = async () => {
    if (!activeOrganization?.id) return;

    setDeleting(true);
    try {
      await OrganizationService.deleteOrganization(activeOrganization.id);
      await refreshOrganizations();
      toast.success('Organization deleted successfully');
    } catch (error: any) {
      toast.error('Failed to delete organization', {
        description: error.response?.data?.message || 'Please try again later.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          Irreversible actions that will permanently affect your organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="p-4 border border-destructive/20 rounded-xl bg-destructive/3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h4 className="font-semibold text-destructive mb-1">
                Delete Organization
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Permanently delete "{activeOrganization?.name}" and all associated workspace data. All members will be switched to their personal accounts.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button id="delete-org-trigger" variant="destructive" size="sm" className="sm:ml-4 rounded-xl flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete organization
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{activeOrganization?.name}"? This action cannot be undone. All organization data will be permanently deleted, and all members will be switched to their personal accounts.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteOrganization}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete organization'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
