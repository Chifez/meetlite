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
import AuthWrapper from '@/components/auth-wrapper';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import api from '@/lib/axios';
import { extractError } from '@/lib/api-response';
import SEO from '@/components/seo';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email address.' }),
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
      await api.post('/api/auth/forgot-password', { email: data.email });
      setIsSubmitted(true);
    } catch (error: any) {
      toast.error('Could not send reset link', {
        description: extractError(error) || 'Please try again in a moment.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── SENT STATE ────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <>
        <SEO title="Check your email · MeetLite" />
        <AuthWrapper
          title="Check your inbox"
          description={`We've sent a reset link to ${form.getValues('email')}. It expires in 15 minutes.`}
          footer={
            <div className="w-full space-y-3 text-center">
              <p className="text-[0.75rem] text-muted-foreground">
                Can't find it? Check your spam folder or{' '}
                <button
                  className="text-primary font-semibold hover:underline"
                  onClick={() => setIsSubmitted(false)}
                >
                  try a different address
                </button>
                .
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </Link>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MailCheck className="w-7 h-7 text-primary" />
            </div>
          </div>
        </AuthWrapper>
      </>
    );
  }

  // ── INPUT STATE ────────────────────────────────────────────────
  return (
    <>
      <SEO title="Reset password · MeetLite" />
      <AuthWrapper
        title="Reset your password"
        description="Enter your account email and we'll send you a secure link to reset your password."
        footer={
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      id="forgot-email"
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
            <Button
              id="forgot-password-submit"
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>
        </Form>
      </AuthWrapper>
    </>
  );
};

export default ForgotPassword;
