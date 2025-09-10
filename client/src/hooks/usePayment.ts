import { useState, useCallback } from 'react';
import { PaymentService } from '../services/paymentService';
import { useToast } from './use-toast';

export const usePayment = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const upgradePlan = useCallback(
    async (
      planType: 'pro' | 'enterprise',
      duration: 'monthly' | 'yearly' = 'monthly'
    ) => {
      setLoading(true);
      try {
        await PaymentService.redirectToCheckout(planType, duration);
      } catch (error: any) {
        console.error('Upgrade error:', error);
        toast({
          title: 'Upgrade Failed',
          description: error.message || 'Failed to start upgrade process',
          variant: 'destructive',
        });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const openBillingPortal = useCallback(async () => {
    setLoading(true);
    try {
      await PaymentService.redirectToBillingPortal();
    } catch (error: any) {
      console.error('Billing portal error:', error);
      toast({
        title: 'Billing Portal Error',
        description: error.message || 'Failed to open billing portal',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handlePaymentSuccess = useCallback(
    async (sessionId: string) => {
      setLoading(true);
      try {
        const result = await PaymentService.handlePaymentSuccess(sessionId);
        toast({
          title: 'Payment Successful!',
          description: 'Your plan has been upgraded successfully.',
        });
        return result;
      } catch (error: any) {
        console.error('Payment success error:', error);
        toast({
          title: 'Payment Error',
          description: error.message || 'Failed to process payment',
          variant: 'destructive',
        });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  return {
    loading,
    upgradePlan,
    openBillingPortal,
    handlePaymentSuccess,
  };
};
