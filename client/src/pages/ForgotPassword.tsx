import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import AuthWrapper from '@/components/AuthWrapper';
import { env } from '@/config/env';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import api from '@/lib/axios';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      await api.post(`${env.AUTH_API_URL}/auth/forgot-password`, {
        email: data.email,
      });

      setIsSubmitted(true);
      toast.success('Reset email sent', {
        description:
          'If an account with that email exists, a password reset link has been sent.',
      });
    } catch (error: any) {
      toast.error('Failed to send reset email', {
        description: error.response?.data?.message || 'Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthWrapper
        title="Check your email"
        description="We've sent a password reset link to your email address."
        footer={
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Didn't receive the email? Check your spam folder
            </p>
            <div className="flex items-between">
              <p className="text-sm text-muted-foreground">
                <Link to="/login" className="text-primary font-medium">
                  Back to sign in
                </Link>
              </p>

              <Button
                variant="link"
                className="p-0 h-auto text-primary font-medium"
                onClick={() => setIsSubmitted(false)}
              >
                try again
              </Button>
            </div>
          </div>
        }
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            We've sent a password reset link to{' '}
            <strong>{form.getValues('email')}</strong>
          </p>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper
      title="Forgot your password?"
      description="Enter your email address and we'll send you a link to reset your password."
      footer={
        <p className="text-sm text-muted-foreground">
          Remember your password?{' '}
          <Link to="/login" className="text-primary font-medium">
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
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending reset link...
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
      </Form>
    </AuthWrapper>
  );
};

export default ForgotPassword;
