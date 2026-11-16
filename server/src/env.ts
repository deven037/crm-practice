export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 50),
  resetRateLimitMax: Number(process.env.RESET_RATE_LIMIT_MAX ?? 10),
  disableLatency: process.env.DISABLE_LATENCY === 'true',
  analysisGithubRepository: process.env.ANALYSIS_GITHUB_REPOSITORY ?? 'deven037/crm-data-science-lab',
  analysisGithubToken: process.env.ANALYSIS_GITHUB_TOKEN ?? '',
  analysisGithubRef: process.env.ANALYSIS_GITHUB_REF ?? 'main',
  analysisWorkflowSecret: process.env.ANALYSIS_WORKFLOW_SECRET ?? '',
  publicApiUrl: process.env.PUBLIC_API_URL ?? '',
  // PostgreSQL connection string (Neon). Empty: PGlite, a Postgres that runs inside this process.
  databaseUrl: process.env.DATABASE_URL ?? '',
  // How much the database may hold, for the console's "storage used" bar. Neon's free plan: 0.5 GB.
  databaseLimitBytes: Number(process.env.DATABASE_LIMIT_MB ?? 512) * 1024 * 1024,
  // Folder PGlite keeps its files in. Empty: memory only (tests).
  pgliteDir: process.env.PGLITE_DIR ?? (process.env.NODE_ENV === 'test' ? '' : '.data/pglite'),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 10),
  // The platform owner's sign-in. Unset: nobody can sign in to the platform console.
  platformAdminEmail: (process.env.PLATFORM_ADMIN_EMAIL ?? '').trim().toLowerCase(),
  platformAdminPassword: process.env.PLATFORM_ADMIN_PASSWORD ?? '',
  demoBankName: process.env.BANK_NAME?.trim() || 'Harbor Demo Bank',
  // The public demo bank keeps the practice app's open reset and forgot-password routes.
  demoOpenRoutes: process.env.DEMO_OPEN_ROUTES !== 'false',
  registerRateLimitMax: Number(process.env.REGISTER_RATE_LIMIT_MAX ?? 10),
};
