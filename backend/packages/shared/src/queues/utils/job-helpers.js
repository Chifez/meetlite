/**
 * Common job utilities for queue operations
 */

/**
 * Validate job data structure
 * @param {object} data - Job data to validate
 * @param {Array<string>} requiredFields - Required field names
 * @throws {Error} If validation fails
 */
export const validateJobData = (data, requiredFields = []) => {
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
 * @param {string} type - Job type
 * @param {string} identifier - Unique identifier
 * @returns {string} Formatted job ID
 */
export const formatJobId = (type, identifier) => {
  return `${type}-${identifier}`;
};

/**
 * Parse job ID to extract type and identifier
 * @param {string} jobId - Job ID
 * @returns {object} Parsed job ID with type and identifier
 */
export const parseJobId = (jobId) => {
  const parts = jobId.split('-');
  if (parts.length < 2) {
    throw new Error('Invalid job ID format');
  }
  return {
    type: parts[0],
    identifier: parts.slice(1).join('-'),
  };
};

/**
 * Create standardized job options
 * @param {object} overrides - Options to override defaults
 * @returns {object} Job options
 */
export const createJobOptions = (overrides = {}) => {
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
 * @param {Error} error - Error object
 * @param {object} job - Job object
 * @returns {object} Error information
 */
export const handleJobError = (error, job) => {
  return {
    error: error.message,
    stack: error.stack,
    jobId: job?.id,
    jobName: job?.name,
    timestamp: new Date().toISOString(),
  };
};

