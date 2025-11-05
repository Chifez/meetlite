import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import AuthWrapper from '../auth-wrapper';
import { PasswordField } from './password-field';
import { GoogleSignInButton } from './google-signin-button';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSubmit: (data: LoginFormValues) => Promise<void>;
  isLoading: boolean;
  invitation?: string | null;
}

export function LoginForm({ onSubmit, isLoading, invitation }: LoginFormProps) {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  return (
    <AuthWrapper
      title="Welcome back"
      description={
        invitation
          ? 'Sign in to accept your organization invitation'
          : 'Sign in to your account to continue'
      }
      footer={
        <p className="text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link
            to={`/signup${invitation ? `?invitation=${invitation}` : ''}`}
            className="text-primary font-medium"
          >
            Sign up
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="your@email.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <PasswordField
            control={form.control}
            name="password"
            label="Password"
          />

          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Forgot your password?
            </Link>
          </div>

          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </Form>

      <div className="pt-4">
        <GoogleSignInButton mode="login" />
      </div>
    </AuthWrapper>
  );
}
