import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../services/auth/tokenService.js';

export function authenticateRequest(req, res, next) {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return next(
      new AppError(401, 'AUTH_MISSING_TOKEN', 'You must be signed in to access this resource.')
    );
  }

  const token = authorization.slice('Bearer '.length).trim();
  req.user = verifyAccessToken(token);
  next();
}
