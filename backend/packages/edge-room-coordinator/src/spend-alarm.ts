/**
 * Commercial Spend Alarms, Usage Bounding & Emergency Admission Throttle
 *
 * Implements S6-01 / Phase 6:
 * Protects MeetLite against runaway cloud bills and viral traffic spikes.
 * Maintains an application-side usage and cost estimate based on participant-time
 * and measured egress at $0.05 / GB, with multi-stage alarm thresholds and
 * audited manual overrides.
 */

import { RoomTier } from '@minimeet/shared';

export interface CommercialSpendConfig {
  readonly egressPricePerGb?: number; // Cloudflare Realtime SFU: $0.05 / GB
  readonly averageEgressGbPerParticipantMinute?: number; // ~0.01515 GB/min (2.02 Mbps)
  readonly threshold1Dollars?: number; // $10,000 / month: Informational alert
  readonly threshold2Dollars?: number; // $50,000 / month: Commercial review trigger
  readonly threshold3Dollars?: number; // $250,000 / month: Application emergency throttle
  readonly onAlert?: (alert: SpendAlert) => void;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SpendAlert {
  readonly thresholdLevel: 1 | 2 | 3;
  readonly severity: AlertSeverity;
  readonly currentSpendDollars: number;
  readonly thresholdDollars: number;
  readonly message: string;
  readonly timestamp: number;
}

export interface SpendEstimate {
  readonly totalParticipantMinutes: number;
  readonly totalEgressGb: number;
  readonly estimatedCostDollars: number;
  readonly activeThreshold: 0 | 1 | 2 | 3;
  readonly throttledTiers: readonly RoomTier[];
  readonly manualOverrideActive: boolean;
  readonly manualOverrideAuditor?: string;
}

export class SpendAlarmManager {
  private readonly egressPricePerGb: number;
  private readonly avgEgressGbPerMin: number;
  private readonly threshold1: number;
  private readonly threshold2: number;
  private readonly threshold3: number;
  private readonly onAlert?: (alert: SpendAlert) => void;

  private totalParticipantMinutes = 0;
  private totalEgressGb = 0;
  private highestAlertTriggered: 0 | 1 | 2 | 3 = 0;

  private manualOverride = false;
  private manualOverrideAuditor?: string;
  private manualOverrideReason?: string;

  constructor(config: CommercialSpendConfig = {}) {
    this.egressPricePerGb = config.egressPricePerGb ?? 0.05;
    this.avgEgressGbPerMin = config.averageEgressGbPerParticipantMinute ?? 0.01515;
    this.threshold1 = config.threshold1Dollars ?? 10_000;
    this.threshold2 = config.threshold2Dollars ?? 50_000;
    this.threshold3 = config.threshold3Dollars ?? 250_000;
    this.onAlert = config.onAlert;
  }

  /**
   * Records incremental usage: participant-minutes and optional measured egress.
   */
  public recordUsage(participantMinutes: number, measuredEgressGb?: number): SpendEstimate {
    this.totalParticipantMinutes += participantMinutes;
    const computedEgress = measuredEgressGb ?? participantMinutes * this.avgEgressGbPerMin;
    this.totalEgressGb += computedEgress;

    this.checkThresholds();
    return this.getSpendEstimate();
  }

  /**
   * Calculates current estimated monthly spend.
   */
  public calculateCurrentSpend(): number {
    return Number((this.totalEgressGb * this.egressPricePerGb).toFixed(2));
  }

  private checkThresholds(): void {
    const currentSpend = this.calculateCurrentSpend();

    if (currentSpend >= this.threshold3 && this.highestAlertTriggered < 3) {
      this.highestAlertTriggered = 3;
      this.emitAlert({
        thresholdLevel: 3,
        severity: 'critical',
        currentSpendDollars: currentSpend,
        thresholdDollars: this.threshold3,
        message: 'Threshold 3 ($250,000/mo) exceeded: Activating application-level admission throttle for non-enterprise rooms',
        timestamp: Date.now(),
      });
    } else if (currentSpend >= this.threshold2 && this.highestAlertTriggered < 2) {
      this.highestAlertTriggered = 2;
      this.emitAlert({
        thresholdLevel: 2,
        severity: 'warning',
        currentSpendDollars: currentSpend,
        thresholdDollars: this.threshold2,
        message: 'Threshold 2 ($50,000/mo) reached: Initiate commercial review with Cloudflare Enterprise sales for bandwidth discounting',
        timestamp: Date.now(),
      });
    } else if (currentSpend >= this.threshold1 && this.highestAlertTriggered < 1) {
      this.highestAlertTriggered = 1;
      this.emitAlert({
        thresholdLevel: 1,
        severity: 'info',
        currentSpendDollars: currentSpend,
        thresholdDollars: this.threshold1,
        message: 'Threshold 1 ($10,000/mo) reached: Informational notification to engineering team',
        timestamp: Date.now(),
      });
    }
  }

  private emitAlert(alert: SpendAlert): void {
    if (this.onAlert) {
      this.onAlert(alert);
    }
  }

  /**
   * Evaluates admission eligibility under current spend bounds.
   * If Threshold 3 is reached without audited override, non-enterprise room creation/admission is denied.
   */
  public canAdmit(tier: RoomTier = 'free'): { allowed: boolean; code?: string; reason?: string } {
    const currentSpend = this.calculateCurrentSpend();

    if (currentSpend >= this.threshold3) {
      if (this.manualOverride) {
        return { allowed: true };
      }
      if (tier !== 'enterprise') {
        return {
          allowed: false,
          code: 'BILLING_LIMIT_REACHED',
          reason: `Monthly commercial spend limit of $${this.threshold3.toLocaleString()} exceeded. Free and Pro room creation throttled until billing review or executive override.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Sets an audited manual override permitting continued admissions past Threshold 3.
   */
  public setManualOverride(enabled: boolean, auditor: string, reason: string): void {
    if (!auditor || !reason) {
      throw new Error('Manual spend override requires explicit auditor identity and documented rationale');
    }
    this.manualOverride = enabled;
    this.manualOverrideAuditor = enabled ? auditor : undefined;
    this.manualOverrideReason = enabled ? reason : undefined;
  }

  public getSpendEstimate(): SpendEstimate {
    const cost = this.calculateCurrentSpend();
    const activeThreshold =
      cost >= this.threshold3 ? 3 : cost >= this.threshold2 ? 2 : cost >= this.threshold1 ? 1 : 0;

    const throttledTiers: RoomTier[] =
      activeThreshold >= 3 && !this.manualOverride ? ['free', 'pro'] : [];

    return {
      totalParticipantMinutes: this.totalParticipantMinutes,
      totalEgressGb: Number(this.totalEgressGb.toFixed(3)),
      estimatedCostDollars: cost,
      activeThreshold,
      throttledTiers,
      manualOverrideActive: this.manualOverride,
      manualOverrideAuditor: this.manualOverrideAuditor,
    };
  }
}
