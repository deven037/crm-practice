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
};
