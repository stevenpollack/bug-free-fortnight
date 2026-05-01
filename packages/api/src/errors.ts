export type ErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "IMPORT_ERROR"
  | "GENERATION_INVALID_REFERENCE"
  | "GENERATION_UNAVAILABLE"
  | "GENERATION_FAILED"
  | "RATE_LIMITED";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
