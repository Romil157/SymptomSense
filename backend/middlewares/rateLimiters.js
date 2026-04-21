import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config/env.js';

function ipAwareKey(req) {
  return ipKeyGenerator(req.ip);
}

function buildLimiter({ max, message, keyGenerator, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs: config.apiRateLimitWindowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator,
    handler: (req, res) => {
      res.status(429).json({
        requestId: req.id,
        error: {
          code: 'RATE_LIMITED',
          message,
        },
      });
    },
  });
}

export const apiLimiter = buildLimiter({
  max: config.apiRateLimitMax,
  message: 'Too many API requests. Please retry shortly.',
  keyGenerator: (req) => req.user?.sub || ipAwareKey(req),
});

export const authLimiter = buildLimiter({
  max: config.authRateLimitMax,
  message: 'Too many login attempts. Please wait before trying again.',
  keyGenerator: (req) => ipAwareKey(req),
  skipSuccessfulRequests: true,
});

export const aiLimiter = buildLimiter({
  max: config.aiRateLimitMax,
  message: 'Too many AI insight requests. Please retry shortly.',
  keyGenerator: (req) => req.user?.sub || ipAwareKey(req),
});
