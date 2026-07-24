export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what = 'Resource') => new ApiError(404, 'not_found', `${what} not found.`);
export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new ApiError(403, 'forbidden', message);
export const unauthorized = (message = 'Missing or invalid token.') => new ApiError(401, 'unauthorized', message);
export const conflict = (code: string, message: string, details?: unknown) =>
  new ApiError(409, code, message, details);
