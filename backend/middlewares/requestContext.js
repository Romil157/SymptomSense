import { randomUUID } from 'node:crypto';

export function requestContext(req, res, next) {
  req.id = String(req.headers['x-request-id'] || randomUUID());
  req.requestStartedAt = process.hrtime.bigint();
  res.setHeader('x-request-id', req.id);
  next();
}
