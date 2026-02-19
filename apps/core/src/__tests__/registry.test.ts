import { createDatabase } from "@fruitctl/db";
import { describe, expect, it } from "vitest";
import type { AdapterPlugin } from "../adapter.js";
import { registerAdapters } from "../registry.js";
import { createServer } from "../server.js";

function createMockAdapter(name: string, depAvailable = true): AdapterPlugin {
	const plugin: AdapterPlugin = Object.assign(
		async (fastify: any, _opts: any) => {
			fastify.get("/ping", async () => ({ adapter: name }));
		},
		{
			manifest: {
				name,
				version: "0.1.0",
				nativeDeps: [{ name: `${name}-dep`, check: async () => depAvailable }],
				capabilities: [
					{
						name: `list_${name}`,
						description: `List ${name}`,
						requiresApproval: false,
						paramsSchema: {} as any,
					},
				],
			},
		},
	);
	return plugin;
}

describe("registerAdapters", () => {
	it("registers an adapter and its routes are reachable", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, jwtSecret: "test" });
		const adapter = createMockAdapter("reminders");

		const result = await registerAdapters(server, [adapter], {
			db,
			config: {},
		});

		expect(result.registered).toContain("reminders");
		const res = await server.inject({ method: "GET", url: "/reminders/ping" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ adapter: "reminders" });
	});

	it("skips adapter when native dep check fails", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, jwtSecret: "test" });
		const adapter = createMockAdapter("broken", false);

		const result = await registerAdapters(server, [adapter], {
			db,
			config: {},
		});

		expect(result.registered).not.toContain("broken");
		expect(result.skipped).toContain("broken");
	});

	it("aggregates capabilities from all registered adapters", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, jwtSecret: "test" });
		const a1 = createMockAdapter("reminders");
		const a2 = createMockAdapter("things");

		const result = await registerAdapters(server, [a1, a2], {
			db,
			config: {},
		});

		expect(result.capabilities).toHaveLength(2);
		expect(result.capabilities.map((c) => c.name)).toEqual([
			"list_reminders",
			"list_things",
		]);
	});
});
