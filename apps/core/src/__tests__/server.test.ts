import { describe, it, expect } from "vitest";
import { createServer } from "../server.js";
import { createDatabase } from "@fruitctl/db";

describe("createServer", () => {
  it("creates a fastify instance with health endpoint", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test-secret" });
    const res = await server.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("returns 401 for protected routes without token", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test-secret" });
    server.get("/protected", { preHandler: [server.authenticate] }, async () => {
      return { data: "secret" };
    });
    const res = await server.inject({ method: "GET", url: "/protected" });
    expect(res.statusCode).toBe(401);
  });

  it("allows access with valid JWT", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test-secret" });
    server.get("/protected", { preHandler: [server.authenticate] }, async () => {
      return { data: "secret" };
    });
    await server.ready();
    const token = server.jwt.sign({ sub: "test" });
    const res = await server.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns structured errors for AppError", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test-secret" });
    const { AppError, ErrorCode } = await import("../errors.js");
    server.get("/fail", async () => {
      throw new AppError(ErrorCode.NOT_FOUND, "Thing not found");
    });
    const res = await server.inject({ method: "GET", url: "/fail" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Thing not found",
        retryable: false,
        details: {},
      },
    });
  });
});
