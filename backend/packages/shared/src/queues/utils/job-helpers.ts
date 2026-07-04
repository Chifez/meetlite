/**
 * Common job utilities for queue operations
 */

/**
 * Validate job data structure
 * @param data - Job data to validate
 * @param requiredFields - Required field names
 * @throws {Error} If validation fails
 */
export const validateJobData = (data: any, requiredFields: string[] = []): void => {
  if (!data || typeof data !== 'object') {
    throw new Error('Job data must be an object');
  }

  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
};

/**
 * Format job ID from type and identifier
 * @param type - Job type
 * @param identifier - Unique identifier
 * @returns Formatted job ID
 */
export const formatJobId = (type: string, identifier: string | number): string => {
  return `${type}-${identifier}`;
};

/**
 * Parse job ID to extract type and identifier
 * @param jobId - Job ID
 * @returns Parsed job ID with type and identifier
 */
export const parseJobId = (jobId: string): { type: string; identifier: string } => {
  const parts = jobId.split('-');
  if (parts.length < 2) {
    throw new Error('Invalid job ID format');
  }
  return {
    type: parts[0]!,
    identifier: parts.slice(1).join('-'),
  };
};

/**
 * Create standardized job options
 * @param overrides - Options to override defaults
 * @returns Job options
 */
export const createJobOptions = (overrides: Record<string, any> = {}): Record<string, any> => {
  return {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
    },
    ...overrides,
  };
};

/**
 * Handle job processing errors
 * @param error - Error object
 * @param job - Job object
 * @returns Error information
 */
export const handleJobError = (error: Error, job: any): Record<string, any> => {
  return {
    error: error.message,
    stack: error.stack,
    jobId: job?.id,
    jobName: job?.name,
    timestamp: new Date().toISOString(),
  };
};
