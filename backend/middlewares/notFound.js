import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `No route found for ${req.method} ${req.originalUrl}.`));
}
