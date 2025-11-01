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
import { TermsCheckbox } from './terms-checkbox';
import { GoogleSignInButton } from './google-signin-button';

const signupSchema = z
  .object({
    email: z.string().email({ message: 'Please enter a valid email address' }),
    password: z
      .string()
      .min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z
      .string()
      .min(6, { message: 'Password must be at least 6 characters' }),
    agreeToTerms: z.boolean().refine((val) => val === true, {
      message: 'You must agree to the terms and conditions',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

interface SignupFormProps {
  onSubmit: (data: SignupFormValues) => Promise<void>;
  isLoading: boolean;
  invitation?: string | null;
}

export function SignupForm({
  onSubmit,
  isLoading,
  invitation,
}: SignupFormProps) {
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
    },
  });

  return (
    <AuthWrapper
      title="Create an account"
      description={
        invitation
          ? 'Create an account to accept your organization invitation'
          : 'Enter your details to get started'
      }
      footer={
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to={`/login${invitation ? `?invitation=${invitation}` : ''}`}
            className="text-primary font-medium"
          >
            Sign in
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

          <PasswordField
            control={form.control}
            name="confirmPassword"
            label="Confirm Password"
          />

          <TermsCheckbox control={form.control} />

          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
      </Form>

      <div className="pt-4">
        <GoogleSignInButton mode="signup" />
      </div>
    </AuthWrapper>
  );
}
