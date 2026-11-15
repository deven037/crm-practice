import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './env.js';
import { simulatedLatency } from './middleware/latency.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { openapiDocument } from './openapi.js';
import { getDb } from './pg.js';
import { ensureDemoBank, ensurePlatformAdmin } from './banks.js';

// These routers read their own request bodies (larger limits, or raw bodies).
const OWN_BODY_PARSER = ['/api/analysis/', '/api/platform/', '/api/bank/'];

export function createApp() {
  const app = express();

  // Render puts one proxy in front of the API; this makes rate limits count real visitors.
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.corsOrigin }));
  app.use((req, res, next) => {
    if (OWN_BODY_PARSER.some((prefix) => req.path.startsWith(prefix))) return next();
    return express.json()(req, res, next);
  });
  app.use(simulatedLatency);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, when: new Date().toISOString() });
  });

  app.get('/api/openapi.json', (_req, res) => {
    res.json(openapiDocument);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

  app.use('/api', apiRouter);

  app.use(errorHandler);
  return app;
}

/** Opens the database, creates the tables, the demo bank and the platform owner. Run once before serving. */
export async function prepare(): Promise<void> {
  await getDb();
  await ensureDemoBank();
  await ensurePlatformAdmin();
}
