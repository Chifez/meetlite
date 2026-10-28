import express, { Response } from 'express';
import { ResponseHelpers, AppError } from '@minimeet/shared';
import { asyncHandler } from '../../middleware/error-handler.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { defaultRecurrenceEngine } from '../../meeting-domain/recurrence/recurrence-engine.js';
import {
  parseLocalDate,
  parseLocalTime,
  parseIanaTimeZone,
} from '../../meeting-domain/time/zoned-date-time.js';

const router = express.Router();

/**
 * POST /preview - Preview recurrence occurrences
 * Body: { localDate, localTime, timeZone, recurrence, limit? }
 */
router.post(
  '/preview',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { localDate, localTime, timeZone, recurrence, limit = 5 } = req.body;

    if (!localDate || !localTime || !timeZone || !recurrence) {
      throw AppError.validation(
        'Missing required recurrence preview fields: localDate, localTime, timeZone, recurrence'
      );
    }

    try {
      const parsedDate = parseLocalDate(localDate);
      const parsedTime = parseLocalTime(localTime);
      const parsedZone = parseIanaTimeZone(timeZone);

      const validationResult = defaultRecurrenceEngine.validate({
        localDate: parsedDate,
        localTime: parsedTime,
        timeZone: parsedZone,
        spec: recurrence,
      });

      if (!validationResult.ok) {
        throw AppError.validation(validationResult.error.message);
      }

      const seeds = defaultRecurrenceEngine.preview(
        validationResult.value,
        Number(limit) || 5
      );

      return ResponseHelpers.ok(res, { occurrences: seeds });
    } catch (err: any) {
      if (
        err.code === 'INVALID_LOCAL_DATE' ||
        err.code === 'INVALID_LOCAL_TIME' ||
        err.code === 'INVALID_TIME_ZONE'
      ) {
        throw AppError.validation(err.message);
      }
      throw err;
    }
  })
);

export default router;
