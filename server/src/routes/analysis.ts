import { randomUUID, timingSafeEqual } from 'node:crypto';
import express, { NextFunction, Request, Response, Router } from 'express';
import { env } from '../env.js';
import { ApiError, forbidden, notFound, unauthorized } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { analysisLimiter } from '../middleware/rateLimiter.js';

const MAX_DATASET_BYTES = 20 * 1024 * 1024;
const MAX_RESULT_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 50_000;
const JOB_TTL_MS = 10 * 60 * 1000;

type JobStatus = 'queued' | 'running' | 'complete' | 'failed';
interface AnalysisJob {
  id: string;
  ownerId: string;
  name: string;
  csv: string;
  status: JobStatus;
  createdAt: number;
  report?: Record<string, unknown>;
  error?: string;
  downloaded: boolean;
}

const jobs = new Map<string, AnalysisJob>();
const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) if (job.createdAt < cutoff) jobs.delete(id);
}, 60_000);
cleanupTimer.unref();

export const analysisRouter = Router();

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function hasWorkflowSecret(value: string | undefined): boolean {
  if (!value || !env.analysisWorkflowSecret) return false;
  const supplied = Buffer.from(value);
  const expected = Buffer.from(env.analysisWorkflowSecret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function workflowReady(): boolean {
  return Boolean(
    env.analysisGithubToken &&
    env.analysisWorkflowSecret &&
    env.publicApiUrl &&
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.analysisGithubRepository),
  );
}

function workflowAuth(req: Request): void {
  const value = req.headers.authorization;
  const token = value?.startsWith('Bearer ') ? value.slice(7) : undefined;
  if (!hasWorkflowSecret(token)) throw unauthorized('Invalid workflow credential.');
}

function requireWorkflow(req: Request, _res: Response, next: NextFunction): void {
  try {
    workflowAuth(req);
    next();
  } catch (error) {
    next(error);
  }
}

analysisRouter.get('/config', requireAuth, (_req, res) => {
  res.json({
    repository_url: `https://github.com/${env.analysisGithubRepository}`,
    ready: workflowReady(),
    max_dataset_bytes: MAX_DATASET_BYTES,
    max_rows: MAX_ROWS,
  });
});

analysisRouter.get('/jobs/:id/dataset', requireWorkflow, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.createdAt + JOB_TTL_MS < Date.now()) throw notFound('Analysis job');
  if (job.downloaded || job.status !== 'queued') throw forbidden('Dataset is no longer available to this workflow.');
  job.downloaded = true;
  job.status = 'running';
  res.type('text/csv').send(job.csv);
  job.csv = '';
});

analysisRouter.post('/jobs/:id/result', requireWorkflow, express.json({ limit: '2mb' }), (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.createdAt + JOB_TTL_MS < Date.now()) throw notFound('Analysis job');
  if (job.status === 'complete' || job.status === 'failed') throw forbidden('Analysis job already has a result.');

  const body = req.body as { report?: unknown; error?: unknown };
  if (typeof body.error === 'string' && body.error.trim()) {
    job.status = 'failed';
    job.error = body.error.slice(0, 500);
    job.csv = '';
    res.status(202).json({ ok: true });
    return;
  }
  if (!body.report || typeof body.report !== 'object' || Array.isArray(body.report)) {
    throw new ApiError(400, 'invalid_report', 'Workflow result must include a JSON report.');
  }
  if (jsonBytes(body.report) > MAX_RESULT_BYTES) {
    job.status = 'failed';
    job.error = 'The analysis report exceeded the 2 MB result limit.';
    job.csv = '';
    res.status(202).json({ ok: true });
    return;
  }

  const report = { ...(body.report as Record<string, unknown>) };
  // Runner-only file paths cannot be opened by the browser or retained on the API.
  delete report.processed_dataset;
  delete report.processed_dataset_info;
  delete report.artifacts;
  job.report = report;
  job.status = 'complete';
  job.csv = '';
  res.status(202).json({ ok: true });
});

analysisRouter.use(requireAuth);

analysisRouter.post('/jobs', analysisLimiter, express.json({ limit: '25mb' }), async (req, res, next) => {
  try {
    if (!workflowReady()) {
      throw new ApiError(503, 'workflow_unavailable', 'Hosted analysis is not configured on the CRM server yet.');
    }

    const body = req.body as { name?: unknown; fields?: unknown; rows?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const fields = body.fields;
    const rows = body.rows;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name)) {
      throw new ApiError(400, 'invalid_dataset_name', 'Dataset name must use letters, numbers, underscores, or hyphens.');
    }
    if (!Array.isArray(fields) || fields.length < 1 || fields.length > 200 || !fields.every((field) => typeof field === 'string' && field.length <= 200)) {
      throw new ApiError(400, 'invalid_fields', 'Select between 1 and 200 dataset fields.');
    }
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_ROWS) {
      throw new ApiError(400, 'invalid_rows', `Dataset must contain between 1 and ${MAX_ROWS.toLocaleString()} rows.`);
    }
    if (!rows.every((row) => Array.isArray(row) && row.length === fields.length && row.every((cell) => cell === null || ['string', 'number', 'boolean'].includes(typeof cell)))) {
      throw new ApiError(400, 'invalid_rows', 'Each row must contain one plain value per selected field.');
    }

    const csv = [fields, ...rows].map((row) => (row as unknown[]).map(csvCell).join(',')).join('\r\n');
    if (Buffer.byteLength(csv, 'utf8') > MAX_DATASET_BYTES) {
      throw new ApiError(413, 'dataset_too_large', 'Hosted analysis accepts datasets up to 20 MB.');
    }
    const activeJobs = [...jobs.values()].filter((item) => item.status === 'queued' || item.status === 'running');
    if (activeJobs.length >= 8 || activeJobs.filter((item) => item.ownerId === req.user!.id).length >= 2) {
      throw new ApiError(429, 'analysis_busy', 'Too many analysis jobs are already running. Wait for one to finish and try again.');
    }

    const id = randomUUID();
    const job: AnalysisJob = { id, ownerId: req.user!.id, name, csv, status: 'queued', createdAt: Date.now(), downloaded: false };
    jobs.set(id, job);

    const [owner, repository] = env.analysisGithubRepository.split('/');
    const dispatch = await fetch(`https://api.github.com/repos/${owner}/${repository}/actions/workflows/analyze.yml/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.analysisGithubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'practice-crm-analysis',
      },
      body: JSON.stringify({ ref: env.analysisGithubRef, inputs: { job_id: id, api_base_url: env.publicApiUrl } }),
    });
    if (!dispatch.ok) {
      jobs.delete(id);
      const detail = await dispatch.text();
      throw new ApiError(502, 'workflow_dispatch_failed', `GitHub Actions could not be started (${dispatch.status}). ${detail.slice(0, 300)}`);
    }
    res.status(202).json({ id, name, status: job.status, repository_url: `https://github.com/${env.analysisGithubRepository}` });
  } catch (error) {
    next(error);
  }
});

analysisRouter.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.createdAt + JOB_TTL_MS < Date.now()) throw notFound('Analysis job');
  if (job.ownerId !== req.user!.id) throw forbidden('This analysis job belongs to another user.');
  res.json({ id: job.id, name: job.name, status: job.status, report: job.report, error: job.error });
});
