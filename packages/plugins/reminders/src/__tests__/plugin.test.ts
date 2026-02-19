import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { remindersPlugin } from "../plugin.js";
import { AppError } from "@fruitctl/core";
import { createDatabase } from "@fruitctl/db";

const mockReminders = [
	{ id: "r-1", title: "Milk", completed: false },
	{ id: "r-2", title: "Eggs", completed: true },
];

const mockLists = [
	{ id: "list-1", title: "Groceries" },
	{ id: "list-2", title: "Errands" },
];

describe("reminders plugin", () => {
	function buildServer() {
		const server = Fastify();
		const db = createDatabase(":memory:");

		// Add error handler so AppError produces correct status codes
		server.setErrorHandler(async (error, request, reply) => {
			if (error instanceof AppError) {
				return reply.status(error.statusCode).send(error.toJSON());
			}
			return reply.status(500).send({
				error: {
					code: "INTERNAL_ERROR",
					message: "An unexpected error occurred",
					retryable: false,
					details: {},
				},
			});
		});

		server.register(remindersPlugin, {
			db,
			config: {},
			_mockExec: vi.fn().mockImplementation(async (cmd: string) => {
				if (cmd === "remindctl list --json") {
					return { stdout: JSON.stringify(mockLists) };
				}
				if (cmd.startsWith("remindctl list ")) {
					return { stdout: JSON.stringify(mockReminders) };
				}
				if (cmd.startsWith("remindctl all")) {
					return { stdout: JSON.stringify(mockReminders) };
				}
				return { stdout: "[]" };
			}),
		});
		return server;
	}

	it("GET /lists returns all reminder lists", async () => {
		const server = buildServer();
		const res = await server.inject({ method: "GET", url: "/lists" });
		expect(res.statusCode).toBe(200);
		expect(res.json().items).toEqual(mockLists);
	});

	it("POST /list returns reminders for a specific list", async () => {
		const server = buildServer();
		const res = await server.inject({
			method: "POST",
			url: "/list",
			payload: { list: "Groceries" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().items).toEqual(mockReminders);
	});

	it("POST /list rejects invalid payload", async () => {
		const server = buildServer();
		const res = await server.inject({
			method: "POST",
			url: "/list",
			payload: { list: "" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /get returns a specific reminder", async () => {
		const server = buildServer();
		const res = await server.inject({
			method: "POST",
			url: "/get",
			payload: { id: "r-1" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().item.id).toBe("r-1");
	});

	it("POST /get returns 404 for unknown reminder", async () => {
		const server = buildServer();
		const res = await server.inject({
			method: "POST",
			url: "/get",
			payload: { id: "nonexistent" },
		});
		expect(res.statusCode).toBe(404);
	});
});
