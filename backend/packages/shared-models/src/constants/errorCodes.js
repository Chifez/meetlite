/**
 * Centralized Error Codes for MiniMeet Application
 *
 * This file contains all error codes used across the application.
 * Each error code includes:
 * - A unique identifier
 * - HTTP status code
 * - User-friendly message
 * - Technical description for debugging
 */

export const ERROR_CODES = {
  // Authentication & Authorization Errors (1000-1999)
  AUTH: {
    INVALID_CREDENTIALS: {
      code: 'AUTH_1001',
      statusCode: 401,
      message: 'Invalid email or password',
      description: 'The provided credentials are incorrect',
    },
    TOKEN_EXPIRED: {
      code: 'AUTH_1002',
      statusCode: 401,
      message: 'Your session has expired. Please log in again',
      description: 'JWT token has expired',
    },
    TOKEN_INVALID: {
      code: 'AUTH_1003',
      statusCode: 401,
      message: 'Invalid authentication token',
      description: 'JWT token is malformed or invalid',
    },
    ACCESS_DENIED: {
      code: 'AUTH_1004',
      statusCode: 403,
      message: 'You do not have permission to access this resource',
      description: 'User lacks required permissions',
    },
    ACCOUNT_LOCKED: {
      code: 'AUTH_1005',
      statusCode: 423,
      message:
        'Your account has been temporarily locked due to multiple failed login attempts',
      description: 'Account locked due to security policy',
    },
    EMAIL_NOT_VERIFIED: {
      code: 'AUTH_1006',
      statusCode: 403,
      message: 'Please verify your email address before accessing this feature',
      description: 'User email not verified',
    },
    TWO_FACTOR_REQUIRED: {
      code: 'AUTH_1007',
      statusCode: 202,
      message: 'Two-factor authentication required',
      description: '2FA verification needed',
    },
    TWO_FACTOR_INVALID: {
      code: 'AUTH_1008',
      statusCode: 401,
      message: 'Invalid two-factor authentication code',
      description: '2FA code is incorrect or expired',
    },
  },

  // User Management Errors (2000-2999)
  USER: {
    NOT_FOUND: {
      code: 'USER_2001',
      statusCode: 404,
      message: 'User not found',
      description: 'User with specified ID does not exist',
    },
    EMAIL_EXISTS: {
      code: 'USER_2002',
      statusCode: 409,
      message: 'An account with this email already exists',
      description: 'Email address is already registered',
    },
    INVALID_EMAIL: {
      code: 'USER_2003',
      statusCode: 400,
      message: 'Please provide a valid email address',
      description: 'Email format is invalid',
    },
    WEAK_PASSWORD: {
      code: 'USER_2004',
      statusCode: 400,
      message:
        'Password must be at least 8 characters with uppercase, lowercase, and numbers',
      description: 'Password does not meet security requirements',
    },
    PROFILE_UPDATE_FAILED: {
      code: 'USER_2005',
      statusCode: 500,
      message: 'Failed to update profile information',
      description: 'Database error during profile update',
    },
    AVATAR_UPLOAD_FAILED: {
      code: 'USER_2006',
      statusCode: 500,
      message: 'Failed to upload profile picture',
      description: 'File upload service error',
    },
  },

  // Organization Management Errors (3000-3999)
  ORGANIZATION: {
    NOT_FOUND: {
      code: 'ORG_3001',
      statusCode: 404,
      message: 'Organization not found',
      description: 'Organization with specified ID does not exist',
    },
    NAME_EXISTS: {
      code: 'ORG_3002',
      statusCode: 409,
      message: 'An organization with this name already exists',
      description: 'Organization name is already taken',
    },
    MEMBER_LIMIT_EXCEEDED: {
      code: 'ORG_3003',
      statusCode: 403,
      message: 'Organization member limit exceeded for your plan',
      description: 'Plan limits exceeded',
    },
    INVITATION_INVALID: {
      code: 'ORG_3004',
      statusCode: 400,
      message: 'Invalid or expired invitation',
      description: 'Invitation token is invalid or expired',
    },
    INVITATION_ALREADY_ACCEPTED: {
      code: 'ORG_3005',
      statusCode: 409,
      message: 'This invitation has already been accepted',
      description: 'Invitation was already processed',
    },
    NOT_MEMBER: {
      code: 'ORG_3006',
      statusCode: 403,
      message: 'You are not a member of this organization',
      description: 'User is not part of the organization',
    },
    INSUFFICIENT_PERMISSIONS: {
      code: 'ORG_3007',
      statusCode: 403,
      message: 'You do not have sufficient permissions for this action',
      description: 'User lacks required organization permissions',
    },
  },

  // Meeting Management Errors (4000-4999)
  MEETING: {
    NOT_FOUND: {
      code: 'MEETING_4001',
      statusCode: 404,
      message: 'Meeting not found',
      description: 'Meeting with specified ID does not exist',
    },
    ALREADY_STARTED: {
      code: 'MEETING_4002',
      statusCode: 409,
      message: 'This meeting has already started',
      description: 'Meeting is already in progress',
    },
    ALREADY_ENDED: {
      code: 'MEETING_4003',
      statusCode: 409,
      message: 'This meeting has already ended',
      description: 'Meeting has concluded',
    },
    SCHEDULE_CONFLICT: {
      code: 'MEETING_4004',
      statusCode: 409,
      message: 'This time slot conflicts with an existing meeting',
      description: 'Scheduling conflict detected',
    },
    INVALID_DURATION: {
      code: 'MEETING_4005',
      statusCode: 400,
      message: 'Meeting duration must be between 15 minutes and 8 hours',
      description: 'Duration is outside allowed range',
    },
    PAST_DATE: {
      code: 'MEETING_4006',
      statusCode: 400,
      message: 'Cannot schedule meetings in the past',
      description: 'Meeting start time is in the past',
    },
    ROOM_FULL: {
      code: 'MEETING_4007',
      statusCode: 403,
      message: 'This meeting room is at capacity',
      description: 'Maximum participants reached',
    },
    RECORDING_DISABLED: {
      code: 'MEETING_4008',
      statusCode: 403,
      message: 'Recording is not available for this meeting',
      description: 'Recording feature is disabled',
    },
  },

  // Room & WebRTC Errors (5000-5999)
  ROOM: {
    NOT_FOUND: {
      code: 'ROOM_5001',
      statusCode: 404,
      message: 'Meeting room not found',
      description: 'Room with specified ID does not exist',
    },
    CONNECTION_FAILED: {
      code: 'ROOM_5002',
      statusCode: 500,
      message: 'Failed to establish connection to meeting room',
      description: 'WebRTC connection failed',
    },
    MEDIA_ACCESS_DENIED: {
      code: 'ROOM_5003',
      statusCode: 403,
      message: 'Camera or microphone access denied',
      description: 'User denied media device permissions',
    },
    MEDIA_DEVICE_ERROR: {
      code: 'ROOM_5004',
      statusCode: 500,
      message: 'Error accessing camera or microphone',
      description: 'Media device hardware error',
    },
    NETWORK_ERROR: {
      code: 'ROOM_5005',
      statusCode: 500,
      message: 'Network connection lost',
      description: 'WebRTC network connectivity issue',
    },
    ICE_CONNECTION_FAILED: {
      code: 'ROOM_5006',
      statusCode: 500,
      message: 'Unable to establish peer-to-peer connection',
      description: 'ICE connection establishment failed',
    },
    WEBSOCKET_ERROR: {
      code: 'ROOM_5007',
      statusCode: 500,
      message: 'Communication error with meeting server',
      description: 'WebSocket connection error',
    },
  },

  // File & Recording Errors (6000-6999)
  FILE: {
    UPLOAD_FAILED: {
      code: 'FILE_6001',
      statusCode: 500,
      message: 'Failed to upload file',
      description: 'File upload service error',
    },
    FILE_TOO_LARGE: {
      code: 'FILE_6002',
      statusCode: 413,
      message: 'File size exceeds the maximum allowed limit',
      description: 'File exceeds size restrictions',
    },
    INVALID_FORMAT: {
      code: 'FILE_6003',
      statusCode: 400,
      message: 'File format is not supported',
      description: 'Unsupported file type',
    },
    FILE_NOT_FOUND: {
      code: 'FILE_6004',
      statusCode: 404,
      message: 'File not found',
      description: 'Requested file does not exist',
    },
    STORAGE_ERROR: {
      code: 'FILE_6005',
      statusCode: 500,
      message: 'File storage service is temporarily unavailable',
      description: 'Cloud storage service error',
    },
    RECORDING_PROCESSING_FAILED: {
      code: 'FILE_6006',
      statusCode: 500,
      message: 'Failed to process recording',
      description: 'Recording processing pipeline error',
    },
    TRANSCRIPTION_FAILED: {
      code: 'FILE_6007',
      statusCode: 500,
      message: 'Failed to generate transcript',
      description: 'AI transcription service error',
    },
  },

  // Payment & Subscription Errors (7000-7999)
  PAYMENT: {
    PAYMENT_FAILED: {
      code: 'PAYMENT_7001',
      statusCode: 402,
      message: 'Payment could not be processed',
      description: 'Payment gateway error',
    },
    INVALID_PAYMENT_METHOD: {
      code: 'PAYMENT_7002',
      statusCode: 400,
      message: 'Invalid payment method provided',
      description: 'Payment method validation failed',
    },
    SUBSCRIPTION_EXPIRED: {
      code: 'PAYMENT_7003',
      statusCode: 403,
      message: 'Your subscription has expired',
      description: 'Active subscription required',
    },
    PLAN_LIMIT_EXCEEDED: {
      code: 'PAYMENT_7004',
      statusCode: 403,
      message: 'You have reached the limit for your current plan',
      description: 'Plan usage limits exceeded',
    },
    REFUND_FAILED: {
      code: 'PAYMENT_7005',
      statusCode: 500,
      message: 'Refund could not be processed',
      description: 'Refund processing error',
    },
    WEBHOOK_VERIFICATION_FAILED: {
      code: 'PAYMENT_7006',
      statusCode: 400,
      message: 'Payment webhook verification failed',
      description: 'Webhook signature validation error',
    },
  },

  // AI & Integration Errors (8000-8999)
  AI: {
    SERVICE_UNAVAILABLE: {
      code: 'AI_8001',
      statusCode: 503,
      message: 'AI service is temporarily unavailable',
      description: 'AI service provider error',
    },
    QUOTA_EXCEEDED: {
      code: 'AI_8002',
      statusCode: 429,
      message: 'AI service quota exceeded',
      description: 'AI API rate limit exceeded',
    },
    PROCESSING_FAILED: {
      code: 'AI_8003',
      statusCode: 500,
      message: 'AI processing failed',
      description: 'AI service processing error',
    },
    CALENDAR_SYNC_FAILED: {
      code: 'AI_8004',
      statusCode: 500,
      message: 'Failed to sync with calendar',
      description: 'Calendar integration error',
    },
    SMART_SCHEDULING_FAILED: {
      code: 'AI_8005',
      statusCode: 500,
      message: 'Smart scheduling is currently unavailable',
      description: 'AI scheduling service error',
    },
  },

  // System & Infrastructure Errors (9000-9999)
  SYSTEM: {
    DATABASE_ERROR: {
      code: 'SYSTEM_9001',
      statusCode: 500,
      message: 'Database service is temporarily unavailable',
      description: 'Database connection or query error',
    },
    REDIS_ERROR: {
      code: 'SYSTEM_9002',
      statusCode: 500,
      message: 'Caching service is temporarily unavailable',
      description: 'Redis connection or operation error',
    },
    EMAIL_SERVICE_ERROR: {
      code: 'SYSTEM_9003',
      statusCode: 500,
      message: 'Email service is temporarily unavailable',
      description: 'Email service provider error',
    },
    RATE_LIMIT_EXCEEDED: {
      code: 'SYSTEM_9004',
      statusCode: 429,
      message: 'Too many requests. Please try again later',
      description: 'API rate limit exceeded',
    },
    MAINTENANCE_MODE: {
      code: 'SYSTEM_9005',
      statusCode: 503,
      message: 'System is under maintenance. Please try again later',
      description: 'Application maintenance mode',
    },
    INTERNAL_ERROR: {
      code: 'SYSTEM_9006',
      statusCode: 500,
      message: 'An unexpected error occurred',
      description: 'Unhandled internal error',
    },
    VALIDATION_ERROR: {
      code: 'SYSTEM_9007',
      statusCode: 400,
      message: 'Invalid input data provided',
      description: 'Request validation failed',
    },
    RESOURCE_NOT_FOUND: {
      code: 'SYSTEM_9008',
      statusCode: 404,
      message: 'The requested resource was not found',
      description: 'Generic resource not found',
    },
  },
};

/**
 * Helper function to get error details by code
 * @param {string} errorCode - The error code to look up
 * @returns {Object|null} Error details or null if not found
 */
export const getErrorByCode = (errorCode) => {
  for (const category of Object.values(ERROR_CODES)) {
    for (const error of Object.values(category)) {
      if (error.code === errorCode) {
        return error;
      }
    }
  }
  return null;
};

/**
 * Helper function to create an error object
 * @param {string} errorCode - The error code
 * @param {string} customMessage - Optional custom message override
 * @param {Object} additionalData - Additional error data
 * @returns {Object} Formatted error object
 */
export const createError = (
  errorCode,
  customMessage = null,
  additionalData = {}
) => {
  const errorDetails = getErrorByCode(errorCode);

  if (!errorDetails) {
    return {
      code: 'SYSTEM_9006',
      statusCode: 500,
      message: 'An unexpected error occurred',
      description: 'Unknown error code provided',
      ...additionalData,
    };
  }

  return {
    ...errorDetails,
    message: customMessage || errorDetails.message,
    ...additionalData,
  };
};

/**
 * Helper function to check if an error code exists
 * @param {string} errorCode - The error code to check
 * @returns {boolean} True if error code exists
 */
export const isValidErrorCode = (errorCode) => {
  return getErrorByCode(errorCode) !== null;
};

export default ERROR_CODES;
