import React from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Users } from 'lucide-react';
import { useTeams } from '@/hooks/use-teams';
import { useWorkspace } from '@/contexts/workspace-context';
import type { CreateTeamRequest } from '@/types/team';

interface CreateTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTeamCreated?: () => void;
}

interface CreateTeamForm {
  name: string;
  description?: string;
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
  open,
  onOpenChange,
  onTeamCreated,
}) => {
  const { activeOrganization } = useWorkspace();
  const { createTeam, creating } = useTeams();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTeamForm>({
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = async (data: CreateTeamForm) => {
    if (!activeOrganization?.id) return;

    const teamData: CreateTeamRequest = {
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
    };

    const newTeam = await createTeam(activeOrganization.id, teamData);

    if (newTeam) {
      reset();
      onTeamCreated?.();
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    if (!creating) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create New Team
          </DialogTitle>
          <DialogDescription>
            Create a new team to organize members and collaborate on projects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Team Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Engineering Team"
              {...register('name', {
                required: 'Team name is required',
                minLength: {
                  value: 2,
                  message: 'Team name must be at least 2 characters',
                },
                maxLength: {
                  value: 100,
                  message: 'Team name must be less than 100 characters',
                },
              })}
              disabled={creating}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the team's purpose..."
              rows={3}
              {...register('description', {
                maxLength: {
                  value: 500,
                  message: 'Description must be less than 500 characters',
                },
              })}
              disabled={creating}
            />
            {errors.description && (
              <p className="text-sm text-red-500">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Team'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

