import rateLimit from 'express-rate-limit';
import { env } from '../env.js';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many login attempts. Try again later.' } },
});

export const resetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.resetRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many reset requests. Try again in a minute.' } },
});
