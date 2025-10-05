import { env } from '@/config/env';
import api from '@/lib/axios';

export interface CreateCheckoutSessionRequest {
  planType: 'pro' | 'enterprise';
  duration: 'monthly' | 'yearly';
}

export interface CreateCheckoutSessionResponse {
  success: boolean;
  sessionId: string;
  url: string;
}

export interface CreateBillingPortalResponse {
  success: boolean;
  url: string;
}

export interface PaymentSuccessResponse {
  success: boolean;
  message: string;
  user: {
    id: string;
    email: string;
    plan: {
      type: string;
      status: string;
      startDate: string;
      endDate: string;
    };
  };
  token: string;
}

export class PaymentService {
  /**
   * Create a Stripe checkout session for plan upgrade
   */
  static async createCheckoutSession(
    data: CreateCheckoutSessionRequest
  ): Promise<CreateCheckoutSessionResponse> {
    try {
      const response = await api.post(
        `/api/payment/create-checkout-session`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to create checkout session'
      );
    }
  }

  /**
   * Create a billing portal session for subscription management
   */
  static async createBillingPortalSession(): Promise<CreateBillingPortalResponse> {
    try {
      const response = await api.post(`/api/payment/create-billing-portal`);
      return response.data;
    } catch (error: any) {
      console.error('Error creating billing portal session:', error);
      throw new Error(
        error.response?.data?.message ||
          'Failed to create billing portal session'
      );
    }
  }

  /**
   * Handle successful payment (called from success page)
   */
  static async handlePaymentSuccess(
    sessionId: string
  ): Promise<PaymentSuccessResponse> {
    try {
      const response = await api.get(
        `/api/payment/success?session_id=${sessionId}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Error handling payment success:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to process payment success'
      );
    }
  }

  /**
   * Redirect to Stripe checkout
   */
  static async redirectToCheckout(
    planType: 'pro' | 'enterprise',
    duration: 'monthly' | 'yearly' = 'monthly'
  ) {
    try {
      const { url } = await this.createCheckoutSession({ planType, duration });
      window.location.href = url;
    } catch (error) {
      console.error('Error redirecting to checkout:', error);
      throw error;
    }
  }

  /**
   * Redirect to billing portal
   */
  static async redirectToBillingPortal() {
    try {
      const { url } = await this.createBillingPortalSession();
      window.location.href = url;
    } catch (error) {
      console.error('Error redirecting to billing portal:', error);
      throw error;
    }
  }
}

export default PaymentService;
