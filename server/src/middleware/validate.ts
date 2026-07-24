import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

/** Parses+replaces req.body with the validated/typed result, or throws a ZodError (-> 422 via errorHandler). */
export const validateBody =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
