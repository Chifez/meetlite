import { useState, useEffect } from 'react';
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
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/axios';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z
      .string()
      .min(6, { message: 'Password must be at least 6 characters' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const ResetPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  // Validate reset token on mount
  useEffect(() => {
    const validateToken = async () => {
      const token = searchParams.get('token');
      if (!token) {
        toast.error('Invalid reset link', {
          description: 'The password reset link is invalid or has expired.',
        });
        navigate('/forgot-password');
        return;
      }

      try {
        await api.post(`${env.AUTH_API_URL}/auth/validate-reset-token`, {
          token,
        });
        setIsValidToken(true);
      } catch (error) {
        toast.error('Invalid reset link', {
          description: 'The password reset link is invalid or has expired.',
        });
        navigate('/forgot-password');
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [searchParams, navigate]);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    const token = searchParams.get('token');
    if (!token) return;

    setIsLoading(true);
    try {
      await api.post(`${env.AUTH_API_URL}/auth/reset-password`, {
        token,
        password: data.password,
      });

      toast.success('Password reset successfully', {
        description:
          'Your password has been updated. You can now sign in with your new password.',
      });
      navigate('/login');
    } catch (error: any) {
      toast.error('Failed to reset password', {
        description: error.response?.data?.message || 'Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <AuthWrapper
        title="Validating reset link"
        description="Please wait while we validate your password reset link."
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AuthWrapper>
    );
  }

  if (!isValidToken) {
    return null; // Will redirect to forgot-password
  }

  return (
    <AuthWrapper
      title="Reset your password"
      description="Enter your new password below."
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm New Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting password...
              </>
            ) : (
              'Reset password'
            )}
          </Button>
        </form>
      </Form>
    </AuthWrapper>
  );
};

export default ResetPassword;
