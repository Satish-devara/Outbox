import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string; // pg error codes
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const isDev = process.env.NODE_ENV !== 'production';

  // Handle PostgreSQL-specific errors
  let status = err.statusCode ?? 500;
  let message = err.message ?? 'Internal server error';

  // PG error: invalid UUID syntax
  if (err.message?.includes('invalid input syntax for type uuid')) {
    status = 400;
    message = 'Invalid ID format — must be a valid UUID';
  }

  // PG error: unique violation
  if ((err as AppError & { code?: string }).code === '23505') {
    status = 409;
    message = 'A resource with this ID already exists';
  }

  // PG error: foreign key violation
  if ((err as AppError & { code?: string }).code === '23503') {
    status = 400;
    message = 'Referenced resource does not exist';
  }

  console.error(
    `[${new Date().toISOString()}] ${req.method} ${req.path} — ${status}: ${message}`
  );

  res.status(status).json({
    success: false,
    error: message,
    ...(isDev && { stack: err.stack }),
  });
}
