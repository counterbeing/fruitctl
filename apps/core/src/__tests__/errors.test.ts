import { describe, it, expect } from "vitest";
import { AppError, ErrorCode } from "../errors.js";

describe("AppError", () => {
  it("creates a structured error with code and message", () => {
    const err = new AppError(ErrorCode.VALIDATION_ERROR, "Invalid input");
    expect(err.toJSON()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        retryable: false,
        details: {},
      },
    });
  });

  it("supports retryable flag and details", () => {
    const err = new AppError(ErrorCode.EXECUTION_FAILED, "Timeout", {
      retryable: true,
      details: { adapter: "reminders" },
    });
    const json = err.toJSON();
    expect(json.error.retryable).toBe(true);
    expect(json.error.details).toEqual({ adapter: "reminders" });
  });

  it("maps error codes to HTTP status codes", () => {
    expect(new AppError(ErrorCode.VALIDATION_ERROR, "").statusCode).toBe(400);
    expect(new AppError(ErrorCode.NOT_FOUND, "").statusCode).toBe(404);
    expect(new AppError(ErrorCode.LIST_NOT_ALLOWED, "").statusCode).toBe(403);
    expect(new AppError(ErrorCode.EXECUTION_FAILED, "").statusCode).toBe(500);
  });
});
