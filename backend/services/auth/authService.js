import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { sanitizeFreeText } from '../../utils/sanitizers.js';
import { issueAccessToken } from './tokenService.js';

function normalizeEmail(email) {
  return sanitizeFreeText(email, { maxLength: 120 }).toLowerCase();
}

async function matchesConfiguredPassword(candidatePassword) {
  if (config.authPassword.startsWith('$2a$') || config.authPassword.startsWith('$2b$')) {
    return bcrypt.compare(candidatePassword, config.authPassword);
  }

  const candidateBuffer = Buffer.from(String(candidatePassword));
  const configuredBuffer = Buffer.from(String(config.authPassword));

  if (candidateBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, configuredBuffer);
}

export async function loginClinician({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const configuredEmail = normalizeEmail(config.authEmail);

  if (normalizedEmail !== configuredEmail || !(await matchesConfiguredPassword(password))) {
    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const user = {
    email: configuredEmail,
    role: 'clinician',
    displayName: 'Clinical Reviewer',
  };

  return {
    token: issueAccessToken(user),
    expiresIn: config.jwtExpiresIn,
    user,
  };
}
