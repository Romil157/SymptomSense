import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

const TOKEN_ISSUER = 'symptomsense-api';
const TOKEN_AUDIENCE = 'symptomsense-web';

export function issueAccessToken(user) {
  return jwt.sign(
    {
      sub: user.email,
      role: user.role,
      name: user.displayName,
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    }
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret, {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
  } catch {
    throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Your session is invalid or has expired. Please sign in again.');
  }
}
