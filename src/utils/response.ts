import type { Response } from "express";

interface SuccessOptions {
  status?: number;
  message?: string;
  meta?: Record<string, unknown>;
}

// Every successful response has the shape { success: true, data, message?, meta? }.
export function sendSuccess<T>(res: Response, data: T, options: SuccessOptions = {}): void {
  const { status = 200, message, meta } = options;
  res.status(status).json({
    success: true,
    data,
    ...(message !== undefined && { message }),
    ...(meta !== undefined && { meta }),
  });
}
