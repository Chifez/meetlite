import { Request, Response, NextFunction } from 'express';

/**
 * Validation middleware for request parameters and data
 */

/**
 * Validate room ID format
 */
export const validateRoomId = (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params;

  if (!roomId || typeof roomId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Room ID is required',
    });
  }

  // Basic room ID validation (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(roomId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid room ID format',
    });
  }

  if (roomId.length < 3 || roomId.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Room ID must be between 3 and 50 characters',
    });
  }

  next();
};

/**
 * Validate media state data
 */
export const validateMediaState = (req: Request, res: Response, next: NextFunction) => {
  const { audioEnabled, videoEnabled } = req.body;

  if (typeof audioEnabled !== 'boolean' && audioEnabled !== undefined) {
    return res.status(400).json({
      success: false,
      message: 'audioEnabled must be a boolean',
    });
  }

  if (typeof videoEnabled !== 'boolean' && videoEnabled !== undefined) {
    return res.status(400).json({
      success: false,
      message: 'videoEnabled must be a boolean',
    });
  }

  next();
};

/**
 * Validate chat message data
 */
export const validateChatMessage = (req: Request, res: Response, next: NextFunction) => {
  const { message, type } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Message is required and must be a string',
    });
  }

  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message cannot be empty',
    });
  }

  if (message.length > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Message too long (max 1000 characters)',
    });
  }

  if (type && !['text', 'system', 'notification'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid message type',
    });
  }

  next();
};

/**
 * Validate collaboration mode
 */
export const validateCollaborationMode = (req: Request, res: Response, next: NextFunction) => {
  const { mode } = req.body;

  if (!mode || typeof mode !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Collaboration mode is required',
    });
  }

  const validModes = ['none', 'presentation', 'whiteboard', 'workflow'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid collaboration mode',
    });
  }

  next();
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const { page, limit } = req.query;

  if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
    return res.status(400).json({
      success: false,
      message: 'Page must be a positive integer',
    });
  }

  if (
    limit &&
    (!Number.isInteger(Number(limit)) ||
      Number(limit) < 1 ||
      Number(limit) > 100)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Limit must be between 1 and 100',
    });
  }

  next();
};

/**
 * Validate filename parameter
 */
export const validateFilename = (req: Request, res: Response, next: NextFunction) => {
  const { filename } = req.params;

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Filename is required',
    });
  }

  // Basic filename validation (alphanumeric, dots, hyphens, underscores)
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid filename format',
    });
  }

  if (filename.length > 255) {
    return res.status(400).json({
      success: false,
      message: 'Filename too long',
    });
  }

  next();
};

/**
 * Validate workflow operation data
 */
export const validateWorkflowOperation = (req: Request, res: Response, next: NextFunction) => {
  const { operation } = req.body;

  if (!operation || typeof operation !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Operation data is required',
    });
  }

  if (!operation.type || typeof operation.type !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Operation type is required',
    });
  }

  next();
};

/**
 * Validate whiteboard update data
 */
export const validateWhiteboardUpdate = (req: Request, res: Response, next: NextFunction) => {
  const { update } = req.body;

  if (!update || typeof update !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Update data is required',
    });
  }

  if (
    update.version &&
    (!Number.isInteger(Number(update.version)) || Number(update.version) < 0)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Version must be a non-negative integer',
    });
  }

  next();
};
