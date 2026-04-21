import { AppError } from '../utils/AppError.js';

export function validate(schema, target = 'body') {
  return function validateRequest(req, res, next) {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return next(
        new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', result.error.flatten())
      );
    }

    req[target] = result.data;
    next();
  };
}
