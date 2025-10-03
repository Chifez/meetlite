import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { PaymentService } from '@/services/payment-service';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/lib/types';

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
      setError('No session ID found in URL');
      setLoading(false);
      return;
    }

    const handlePaymentSuccess = async () => {
      try {
        const result = await PaymentService.handlePaymentSuccess(sessionId);

        if (result.success) {
          // Update user context with new plan and token
          // remind me to add the result.token to this updateUser function
          updateUser({ ...result.user, token: result.token } as Partial<User>);

          setSuccess(true);
          toast({
            title: 'Payment Successful!',
            description: 'Your plan has been upgraded successfully.',
          });
        } else {
          setError('Payment was not successful');
        }
      } catch (err: any) {
        console.error('Payment success error:', err);
        setError(err.message || 'Failed to process payment');
      } finally {
        setLoading(false);
      }
    };

    handlePaymentSuccess();
  }, [searchParams, updateUser, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Processing Payment...
            </h2>
            <p className="text-gray-600 text-center">
              Please wait while we confirm your payment and upgrade your plan.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertCircle className="h-8 w-8 text-red-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Payment Error
            </h2>
            <p className="text-gray-600 text-center mb-6">{error}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/settings')}>
                Go to Settings
              </Button>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <CheckCircle className="h-8 w-8 text-green-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Payment Successful! 🎉
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Your plan has been upgraded successfully. You now have access to
              all premium features!
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/settings')}>
                Manage Subscription
              </Button>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default PaymentSuccess;
