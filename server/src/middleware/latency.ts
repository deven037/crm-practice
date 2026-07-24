import { NextFunction, Request, Response } from 'express';
import { env } from '../env.js';

const delay = (min: number, max: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

/** Mirrors the client's original simulated-latency contract (300-1200ms) so timing-based exercises keep working. */
export function simulatedLatency(req: Request, _res: Response, next: NextFunction) {
  if (env.disableLatency) {
    next();
    return;
  }
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  delay(...(isMutation ? [150, 400] : [300, 1200]) as [number, number]).then(next);
}
