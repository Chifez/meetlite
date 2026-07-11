export interface AIProvider {
  /**
   * Generates meeting insights given a pure transcript and metadata.
   */
  generateInsights(params: {
    title: string;
    duration: number;
    transcript: string;
  }): Promise<string>;

  /**
   * Generates a concise summary from a transcript or notes.
   */
  generateSummary(transcript: string, notes?: string): Promise<string>;

  /**
   * Generates a comprehensive meeting summary from a recording transcript, returning structured JSON.
   */
  generateRecordingSummary(params: {
    transcript: string;
    meetingContext: string;
    participantCount: number;
    duration: number;
  }): Promise<any>;

  /**
   * Suggests meeting improvements (duration, participants) based on context.
   */
  generateSuggestions(
    participants: string,
    duration: string | number,
    topic: string
  ): Promise<string>;

  /**
   * Parses a raw text description of a meeting into structured JSON.
   */
  parseMeetingDescription(
    input: string,
    timezone: string,
    teamsContext: any[]
  ): Promise<any>;
}
