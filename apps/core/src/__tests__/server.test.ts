import { createDatabase } from "@fruitctl/db";
import { describe, expect, it } from "vitest";
import { deriveKey } from "../auth.js";
import { createServer } from "../server.js";

const SECRET = "test-secret-long-enough";
const ADMIN_KEY = deriveKey("admin", SECRET);
const AGENT_KEY = deriveKey("agent", SECRET);

describe("createServer", () => {
	it("creates a fastify instance with health endpoint", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		const res = await server.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ status: "ok" });
	});

	it("returns 401 for protected routes without token", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		server.get(
			"/protected",
			{ preHandler: [server.authenticate] },
			async () => ({ data: "secret" }),
		);
		const res = await server.inject({ method: "GET", url: "/protected" });
		expect(res.statusCode).toBe(401);
	});

	it("allows access with valid admin key", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		server.get(
			"/protected",
			{ preHandler: [server.authenticate] },
			async (request) => ({ role: request.role }),
		);
		const res = await server.inject({
			method: "GET",
			url: "/protected",
			headers: { authorization: `Bearer ${ADMIN_KEY}` },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().role).toBe("admin");
	});

	it("allows access with valid agent key", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		server.get(
			"/protected",
			{ preHandler: [server.authenticate] },
			async (request) => ({ role: request.role }),
		);
		const res = await server.inject({
			method: "GET",
			url: "/protected",
			headers: { authorization: `Bearer ${AGENT_KEY}` },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().role).toBe("agent");
	});

	it("returns 401 for invalid token", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		server.get(
			"/protected",
			{ preHandler: [server.authenticate] },
			async () => ({ data: "secret" }),
		);
		const res = await server.inject({
			method: "GET",
			url: "/protected",
			headers: { authorization: "Bearer bad-token" },
		});
		expect(res.statusCode).toBe(401);
	});

	it("returns structured errors for AppError", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		const { AppError, ErrorCode } = await import("@fruitctl/shared");
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
