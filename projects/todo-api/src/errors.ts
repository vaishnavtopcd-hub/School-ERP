/**
 * Domain errors carry an HTTP status so the service layer never imports
 * Express, and the error handler never needs a lookup table of its own.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} "${id}" was not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super('The request body is invalid', 400, details);
  }
}
