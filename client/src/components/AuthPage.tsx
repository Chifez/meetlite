import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
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
import AuthWrapper from './AuthWrapper';
import Cookies from 'js-cookie';
import { env } from '@/config/env';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

interface AuthPageProps {
  mode: 'login' | 'signup';
}

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' }),
});

const signupSchema = z
  .object({
    email: z.string().email({ message: 'Please enter a valid email address' }),
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

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

type FormValues = LoginFormValues | SignupFormValues;

const AuthPage = ({ mode }: AuthPageProps) => {
  const isLogin = mode === 'login';
  const { login, signup, redirectTo, setRedirectTo } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const error = params.get('error');

  const form = useForm<FormValues>({
    resolver: zodResolver(isLogin ? loginSchema : signupSchema),
    defaultValues: isLogin
      ? { email: '', password: '' }
      : { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(
          (data as LoginFormValues).email,
          (data as LoginFormValues).password
        );
      } else {
        await signup(
          (data as SignupFormValues).email,
          (data as SignupFormValues).password
        );
      }
      if (redirectTo) {
        navigate(redirectTo);
        setRedirectTo(null);
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      // Error handled in context
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OAuth callback immediately
  useMemo(() => {
    if (token) {
      Cookies.set('token', token, { secure: true, sameSite: 'lax' });
      navigate('/dashboard');
    } else if (error === 'google_oauth_failed') {
      toast.error(
        `Google ${isLogin ? 'sign-in' : 'sign-up'} failed. Please try again.`
      );
    }
  }, [token, error, isLogin, navigate]);

  return (
    <AuthWrapper
      title={isLogin ? 'Welcome back' : 'Create an account'}
      description={
        isLogin
          ? 'Sign in to your account to continue'
          : 'Enter your details to get started'
      }
      footer={
        isLogin ? (
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-medium">
              Sign up
            </Link>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium">
              Sign in
            </Link>
          </p>
        )
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
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
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
          {!isLogin && (
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
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
          )}
          {isLogin && (
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Forgot your password?
              </Link>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? isLogin
                ? 'Signing in...'
                : 'Creating account...'
              : isLogin
              ? 'Sign In'
              : 'Create Account'}
          </Button>
        </form>
      </Form>
      <div className="pt-4">
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center justify-center gap-2"
          onClick={() => {
            window.location.href = `${env.AUTH_API_URL}/auth/google`;
          }}
        >
          <img src="/google.svg" alt="Google" className="w-5 h-5" />
          {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
        </Button>
      </div>
    </AuthWrapper>
  );
};

export default AuthPage;
