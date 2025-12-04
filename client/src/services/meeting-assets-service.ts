import { RecordingService } from './recording-service';
import { UploadService } from './upload-service';
import { ProcessingService } from './processing-service';
import { AnalyticsService } from './analytics-service';
import {
  MeetingRecording,
  MeetingAssetsQuery,
  MeetingAssetsResponse,
  UploadProgress,
  ProcessingResponse,
  ShareLinkResponse,
} from '@/types/meetingAssets';

class MeetingAssetsService {
  private recordingService: RecordingService;
  private uploadService: UploadService;
  private processingService: ProcessingService;
  private analyticsService: AnalyticsService;

  constructor() {
    this.recordingService = new RecordingService();
    this.uploadService = new UploadService();
    this.processingService = new ProcessingService();
    this.analyticsService = new AnalyticsService();
  }

  // Recording methods
  async getOrganizationRecordings(
    query: MeetingAssetsQuery = {}
  ): Promise<MeetingAssetsResponse> {
    return this.recordingService.getOrganizationRecordings(query);
  }

  async getRecordingById(recordingId: string): Promise<MeetingRecording> {
    return this.recordingService.getRecordingById(recordingId);
  }

  async deleteRecording(recordingId: string): Promise<void> {
    return this.recordingService.deleteRecording(recordingId);
  }

  async archiveRecording(recordingId: string): Promise<void> {
    return this.recordingService.archiveRecording(recordingId);
  }

  async unarchiveRecording(recordingId: string): Promise<void> {
    return this.recordingService.unarchiveRecording(recordingId);
  }

  async getStreamingUrl(recordingId: string): Promise<{
    streamingUrl: string;
    thumbnailUrl?: string;
  }> {
    return this.recordingService.getStreamingUrl(recordingId);
  }

  async generateShareLink(recordingId: string): Promise<ShareLinkResponse> {
    return this.recordingService.generateShareLink(recordingId);
  }

  async downloadRecording(recordingId: string): Promise<void> {
    return this.recordingService.downloadRecording(recordingId);
  }

  // Upload methods
  async uploadRecording(
    file: File,
    metadata: {
      title: string;
      description?: string;
      tags?: string[];
      meetingId?: string;
      teamId?: string;
      visibility?: 'organization' | 'participants' | 'private';
    },
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
  ): Promise<any> {
    return this.uploadService.uploadRecording(
      file,
      metadata,
      onProgress,
      signal
    );
  }

  // Processing methods
  async startProcessing(
    recordingId: string,
    type: 'transcript' | 'summary' | 'both'
  ): Promise<ProcessingResponse> {
    return this.processingService.startProcessing(recordingId, type);
  }

  async getProcessingStatus(recordingId: string): Promise<ProcessingResponse> {
    return this.processingService.getProcessingStatus(recordingId);
  }

  // Analytics methods
  async getOrganizationStats(organizationId: string): Promise<{
    totalRecordings: number;
    totalSize: number;
    totalDuration: number;
    completedTranscripts: number;
    completedSummaries: number;
  }> {
    return this.analyticsService.getOrganizationAnalytics(organizationId);
  }

  async getRecordingStats(organizationId: string): Promise<{
    totalRecordings: number;
    totalSize: number;
    totalDuration: number;
    completedTranscripts: number;
    completedSummaries: number;
  }> {
    return this.analyticsService.getRecordingStats(organizationId);
  }
}

export const meetingAssetsService = new MeetingAssetsService();
export type { MeetingRecording, MeetingAssetsQuery, MeetingAssetsResponse };
