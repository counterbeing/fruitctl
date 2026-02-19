import { createDatabase } from "@fruitctl/db";
import type { FastifyPluginAsync } from "fastify";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AdapterPlugin, AdapterPluginOptions } from "@fruitctl/shared";
import { ApprovalEngine } from "../approval.js";
import { registerProposalRoutes } from "../proposals-routes.js";
import { registerAdapters } from "../registry.js";
import { createServer } from "../server.js";

const migrationsFolder = resolve(
	import.meta.dirname,
	"../../../../packages/db/drizzle",
);

function createTestRemindersAdapter(): AdapterPlugin {
	const plugin: FastifyPluginAsync<
		AdapterPluginOptions & { _mockExec?: any }
	> = async (fastify, _opts) => {
		fastify.get("/lists", async () => ({
			items: [{ id: "list-1", title: "Groceries" }],
		}));
		fastify.post("/list", async (_request) => ({
			items: [{ id: "r-1", title: "Milk", completed: false }],
		}));
	};

	return Object.assign(plugin, {
		manifest: {
			name: "reminders",
			version: "0.1.0",
			nativeDeps: [{ name: "remindctl", check: async () => true }],
			capabilities: [
				{
					name: "list_lists",
					description: "List lists",
					requiresApproval: false,
					paramsSchema: {} as any,
				},
			],
		},
	});
}

function createTestAdapterWithActions(
	executeFn: (params: unknown) => Promise<unknown>,
): AdapterPlugin {
	const plugin: FastifyPluginAsync<AdapterPluginOptions> = async (
		fastify,
		opts,
	) => {
		fastify.post("/write", async (request) => {
			const body = request.body as { action: string; params: unknown };
			return opts.approval.propose({
				adapter: "test-adapter",
				action: body.action,
				params: body.params,
			});
		});
	};

	return Object.assign(plugin, {
		manifest: {
			name: "test-adapter",
			version: "0.1.0",
			nativeDeps: [],
			capabilities: [
				{
					name: "write_item",
					description: "Write an item",
					requiresApproval: true,
					paramsSchema: {} as any,
				},
			],
			actions: {
				write_item: {
					name: "write_item",
					description: "Write an item",
					paramsSchema: {} as any,
					validate: async (params: unknown) => params,
					execute: executeFn,
				},
			},
		},
	});
}

describe("integration: server + adapter", () => {
	it("boots server, registers adapter, serves requests", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, jwtSecret: "test-secret-long-enough" });
		const adapter = createTestRemindersAdapter();

		await registerAdapters(server, [adapter], {
			db,
			config: {},
			approval: { propose: async () => ({ id: "mock", status: "approved" }) },
		});

		// Health check works
		const health = await server.inject({ method: "GET", url: "/health" });
		expect(health.statusCode).toBe(200);

		// Adapter route works
		const lists = await server.inject({
			method: "GET",
			url: "/reminders/lists",
		});
		expect(lists.statusCode).toBe(200);
		expect(lists.json().items).toHaveLength(1);
		expect(lists.json().items[0].title).toBe("Groceries");
	});

	it("wires action registry so approved proposals execute actions", async () => {
		const db = createDatabase(":memory:");
		migrate(db, { migrationsFolder });
		const server = createServer({ db, jwtSecret: "test-secret-long-enough" });

		const executeFn = vi.fn().mockResolvedValue({ ok: true });
		const adapter = createTestAdapterWithActions(executeFn);

		const engine = new ApprovalEngine(db);
		registerProposalRoutes(server, engine);

		await registerAdapters(server, [adapter], {
			db,
			config: {},
			approval: engine,
		});

		// Submit a write request via the adapter route -> creates proposal
		const writeRes = await server.inject({
			method: "POST",
			url: "/test-adapter/write",
			payload: { action: "write_item", params: { title: "Buy milk" } },
		});
		expect(writeRes.statusCode).toBe(200);
		const proposal = writeRes.json();
		expect(proposal.status).toBe("pending");
		expect(proposal.id).toBeDefined();

		// Approve the proposal via the proposals route
		const approveRes = await server.inject({
			method: "POST",
			url: `/proposals/${proposal.id}/approve`,
		});
		expect(approveRes.statusCode).toBe(200);
		expect(approveRes.json().status).toBe("approved");

		// Verify the execute function was called with the correct params
		expect(executeFn).toHaveBeenCalledOnce();
		expect(executeFn).toHaveBeenCalledWith({ title: "Buy milk" });
	});
});
