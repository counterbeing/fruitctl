export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  LIST_NOT_ALLOWED = "LIST_NOT_ALLOWED",
  CALENDAR_NOT_ALLOWED = "CALENDAR_NOT_ALLOWED",
  PROPOSAL_NOT_FOUND = "PROPOSAL_NOT_FOUND",
  EXECUTION_FAILED = "EXECUTION_FAILED",
  APPROVAL_REQUIRED = "APPROVAL_REQUIRED",
  UNAUTHORIZED = "UNAUTHORIZED",
}

const STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.LIST_NOT_ALLOWED]: 403,
  [ErrorCode.CALENDAR_NOT_ALLOWED]: 403,
  [ErrorCode.PROPOSAL_NOT_FOUND]: 404,
  [ErrorCode.EXECUTION_FAILED]: 500,
  [ErrorCode.APPROVAL_REQUIRED]: 202,
  [ErrorCode.UNAUTHORIZED]: 401,
};

interface AppErrorOptions {
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.code = code;
    this.statusCode = STATUS_MAP[code];
    this.retryable = options.retryable ?? false;
    this.details = options.details ?? {};
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        details: this.details,
      },
    };
  }
}
