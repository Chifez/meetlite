import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { PaymentService } from '@/services/payment-service';
import { useAuth } from '@/hooks/use-auth';
import Cookies from 'js-cookie';
import { useToast } from '@/hooks/use-toast';
import Logo from '@/components/logo';
import SEO from '@/components/seo';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      setError('No checkout session was found. If you were charged, please contact support.');
      setLoading(false);
      return;
    }

    const handlePaymentSuccess = async () => {
      try {
        const result = await PaymentService.handlePaymentSuccess(sessionId);
        if (result.success) {
          if (result.token) {
            Cookies.set('token', result.token, { secure: true, sameSite: 'lax' });
          }
          updateUser({
            plan: {
              type: result.user.plan.type as 'free' | 'pro' | 'enterprise',
              status: result.user.plan.status as 'active' | 'expired' | 'cancelled',
              startDate: result.user.plan.startDate ? new Date(result.user.plan.startDate) : undefined,
              endDate: result.user.plan.endDate ? new Date(result.user.plan.endDate) : null,
            },
          });
          setSuccess(true);
          toast({ title: 'Plan upgraded successfully.' });
        } else {
          setError('The payment could not be confirmed. Please contact support if you were charged.');
        }
      } catch (err: any) {
        console.error('Payment success error:', err);
        setError(err.message || 'Something went wrong while activating your plan.');
      } finally {
        setLoading(false);
      }
    };

    handlePaymentSuccess();
  }, [searchParams, updateUser, toast]);

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <SEO title="Payment · MeetLite" />
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
      </div>
      <div className="relative w-full max-w-[400px] text-center space-y-6">
        <div className="flex justify-center mb-2">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );

  // ── LOADING ────────────────────────────────────────────────────
  if (loading) {
    return (
      <Wrapper>
        <div className="border border-border rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
          <div>
            <h1 className="text-[1.125rem] font-bold text-foreground tracking-[-0.02em]">
              Confirming payment…
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground mt-1">
              Please stay on this page while we activate your plan.
            </p>
          </div>
        </div>
      </Wrapper>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────
  if (error) {
    return (
      <Wrapper>
        <div className="border border-destructive/30 rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-[1.125rem] font-bold text-foreground tracking-[-0.02em]">
              Payment error
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground mt-1 leading-relaxed">{error}</p>
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate('/settings')}>
              Go to settings
            </Button>
            <Button size="sm" className="flex-1" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
          </div>
        </div>
      </Wrapper>
    );
  }

  // ── SUCCESS ────────────────────────────────────────────────────
  if (success) {
    return (
      <Wrapper>
        <div className="border border-border rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-[1.125rem] font-bold text-foreground tracking-[-0.02em]">
              You're all set!
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground mt-1 leading-relaxed">
              Your plan has been activated. All premium features are now available across your account and workspaces.
            </p>
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate('/settings')}>
              Manage subscription
            </Button>
            <Button size="sm" className="flex-1 gap-1.5" onClick={() => navigate('/dashboard')}>
              Go to dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Wrapper>
    );
  }

  return null;
};

export default PaymentSuccess;
