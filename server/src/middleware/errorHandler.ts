import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../errors.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'validation_error',
        message: 'Request failed validation.',
        details: err.flatten(),
      },
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong.' } });
};
