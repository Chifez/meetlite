/**
 * MeetLite Client Feature Flags & Typed Kill Switches
 * Follows MLTR-00 specification for containing unverified legacy features.
 */
export interface FeatureFlags {
  /**
   * recurringMeetingsEnabled
   * Owner: MLTR-00
   * Risk: High (Legacy recurrence engine has confirmed DST drift and schema crashes)
   * Behavior: When false, disables recurring scheduling controls in the UI.
   * Can be overridden via VITE_FEATURE_RECURRING_MEETINGS environment variable.
   */
  recurringMeetingsEnabled: boolean;
}

export const features: FeatureFlags = {
  recurringMeetingsEnabled:
    import.meta.env.VITE_FEATURE_RECURRING_MEETINGS !== 'false',
};
