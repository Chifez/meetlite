export interface SentEmail {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  metadata?: Record<string, unknown>;
  sentAt: Date;
}

/**
 * Deterministic Mailer Fake.
 * Captures sent emails in memory for assertion without network calls.
 */
export class FakeMailer {
  private sent: SentEmail[] = [];
  private shouldFail = false;
  private failureError: Error = new Error('Simulated email transport failure');

  async send(params: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ messageId: string }> {
    if (this.shouldFail) {
      throw this.failureError;
    }

    const email: SentEmail = {
      ...params,
      sentAt: new Date(),
    };
    this.sent.push(email);

    return { messageId: `msg_${this.sent.length}` };
  }

  getSent(): SentEmail[] {
    return [...this.sent];
  }

  getLast(): SentEmail | undefined {
    return this.sent[this.sent.length - 1];
  }

  findByRecipient(email: string): SentEmail[] {
    return this.sent.filter((s) => s.to === email);
  }

  clear(): void {
    this.sent = [];
    this.shouldFail = false;
  }

  simulateFailure(shouldFail = true, error?: Error): void {
    this.shouldFail = shouldFail;
    if (error) this.failureError = error;
  }
}
