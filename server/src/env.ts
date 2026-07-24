export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 8),
  resetRateLimitMax: Number(process.env.RESET_RATE_LIMIT_MAX ?? 10),
  disableLatency: process.env.DISABLE_LATENCY === 'true',
};
