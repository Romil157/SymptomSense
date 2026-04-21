import { logger } from '../config/logger.js';
import { AppError, isAppError } from '../utils/AppError.js';

function toAppError(error) {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return new AppError(400, 'INVALID_JSON', 'Request body contains malformed JSON.');
  }

  return new AppError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected server error occurred.');
}

export function errorHandler(error, req, res) {
  const appError = toAppError(error);

  logger.error('Request failed.', {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    error,
  });

  res.status(appError.statusCode).json({
    requestId: req.id,
    error: {
      code: appError.code,
      message:
        appError.statusCode >= 500
          ? 'An unexpected server error occurred.'
          : appError.message,
      details: appError.details,
    },
  });
}
