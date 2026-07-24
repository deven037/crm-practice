import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './env.js';
import { simulatedLatency } from './middleware/latency.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { openapiDocument } from './openapi.js';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
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

app.listen(env.port, () => {
  console.log(`crm-practice-server listening on :${env.port}`);
});
