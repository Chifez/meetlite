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

  // Handle organization deletion
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
        <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-destructive mb-1">
                Delete Organization
              </h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete "{activeOrganization?.name}" and all
                associated data
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="ml-4">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{activeOrganization?.name}
                    "? This action cannot be undone. All organization data will
                    be permanently deleted, and all members will be switched to
                    their personal accounts.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteOrganization}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete Organization'
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
