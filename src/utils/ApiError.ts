export interface FieldError {
  field: string;
  message: string;
}

// An expected error with an HTTP status. The error handler turns it into
// { success: false, message, errors? }.
export class ApiError extends Error {
  readonly statusCode: number;
  readonly errors?: FieldError[];

  constructor(statusCode: number, message: string, errors?: FieldError[]) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}
