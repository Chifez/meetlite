import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
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
    email: z.string().email({ message: 'Enter a valid email address.' }),
    password: z
      .string()
      .min(6, { message: 'Password must be at least 6 characters.' }),
    confirmPassword: z
      .string()
      .min(6, { message: 'Password must be at least 6 characters.' }),
    agreeToTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms to continue.',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
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
      title="Create your account"
      description={
        invitation
          ? 'Set up your account to accept the workspace invitation.'
          : 'Start collaborating with your team in minutes.'
      }
      footer={
        <p className="text-[0.8125rem] text-muted-foreground">
          Already have an account?{' '}
          <Link
            to={`/login${invitation ? `?invitation=${invitation}` : ''}`}
            className="text-primary font-semibold hover:underline"
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
                <FormLabel>Work email</FormLabel>
                <FormControl>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    {...field}
                  />
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
            label="Confirm password"
          />

          <TermsCheckbox control={form.control} />

          <Button
            id="signup-submit"
            type="submit"
            className="w-full mt-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>
      </Form>

      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-[0.75rem] text-muted-foreground">
            or continue with
          </span>
        </div>
      </div>

      <GoogleSignInButton mode="signup" />
    </AuthWrapper>
  );
}
