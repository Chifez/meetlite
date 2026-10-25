export interface CustomerRecord {
  customerId: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface SubscriptionRecord {
  subscriptionId: string;
  customerId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodEnd: number;
}

/**
 * Deterministic Payment Fake.
 * Simulates payment provider (Stripe) operations in memory.
 */
export class FakePaymentService {
  private customers = new Map<string, CustomerRecord>();
  private subscriptions = new Map<string, SubscriptionRecord>();
  private customerCounter = 0;
  private subscriptionCounter = 0;

  async createCustomer(email: string, name?: string): Promise<CustomerRecord> {
    this.customerCounter += 1;
    const customer: CustomerRecord = {
      customerId: `cus_test_${this.customerCounter}`,
      email,
      name,
    };
    this.customers.set(customer.customerId, customer);
    return customer;
  }

  async createSubscription(customerId: string, planId: string): Promise<SubscriptionRecord> {
    if (!this.customers.has(customerId)) {
      throw new Error(`Customer ${customerId} not found`);
    }

    this.subscriptionCounter += 1;
    const subscription: SubscriptionRecord = {
      subscriptionId: `sub_test_${this.subscriptionCounter}`,
      customerId,
      planId,
      status: 'active',
      currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    };
    this.subscriptions.set(subscription.subscriptionId, subscription);
    return subscription;
  }

  async cancelSubscription(subscriptionId: string): Promise<SubscriptionRecord> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }
    sub.status = 'canceled';
    return sub;
  }

  getSubscription(subscriptionId: string): SubscriptionRecord | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  clear(): void {
    this.customers.clear();
    this.subscriptions.clear();
    this.customerCounter = 0;
    this.subscriptionCounter = 0;
  }
}
