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
  readonly statusCode: number;
  readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
