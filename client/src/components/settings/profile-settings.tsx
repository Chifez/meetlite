import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { Loader2, User } from 'lucide-react';
import api from '@/lib/axios';
import { env } from '@/config/env';
import ProfileDangerZone from '@/components/settings/profile-danger-zone';

// User settings schema
const userSettingsSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be less than 50 characters'),
  useNameInMeetings: z.boolean(),
});

type UserSettingsFormValues = z.infer<typeof userSettingsSchema>;

export default function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const [userLoading, setUserLoading] = useState(false);

  const userForm = useForm<UserSettingsFormValues>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      name: user?.name || '',
      useNameInMeetings: user?.useNameInMeetings || false,
    },
    values: {
      name: user?.name || '',
      useNameInMeetings: user?.useNameInMeetings || false,
    },
  });

  // Handle user settings submission
  const onUserSubmit = async (data: UserSettingsFormValues) => {
    setUserLoading(true);
    try {
      await api.put(`${env.AUTH_API_URL}/auth/profile`, data, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      // Update user context with new data
      if (updateUser) {
        updateUser({
          name: data.name,
          useNameInMeetings: data.useNameInMeetings,
        });
      }

      toast.success('Profile settings updated successfully');
    } catch (error: any) {
      toast.error('Failed to update profile settings', {
        description: error.response?.data?.message || 'Please try again later.',
      });
    } finally {
      setUserLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Settings
          </CardTitle>
          <CardDescription>
            Update your profile information and meeting preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...userForm}>
            <form
              onSubmit={userForm.handleSubmit(onUserSubmit)}
              className="space-y-6"
            >
              <FormField
                control={userForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your name"
                        {...field}
                        className="max-w-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <Label className="text-base font-medium">
                  Meeting Preferences
                </Label>

                <FormField
                  control={userForm.control}
                  name="useNameInMeetings"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 max-w-xl">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Show name in meetings
                        </FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Display your name instead of email address in meeting
                          participants list
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={userLoading} className="max-w-xl">
                {userLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Profile Changes'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <ProfileDangerZone />
    </div>
  );
}
