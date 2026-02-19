import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import type {
	ActionDef,
	AdapterManifest,
	ApprovalEngineInterface,
} from "../adapter.js";

describe("ActionDef", () => {
	it("can be constructed with validate and execute functions", async () => {
		const action: ActionDef = {
			name: "test-action",
			description: "A test action",
			paramsSchema: z.object({ value: z.string() }),
			validate: async (params) => params,
			execute: async (params) => ({ ok: true, params }),
		};

		expect(action.name).toBe("test-action");
		expect(await action.validate({ value: "hello" })).toEqual({
			value: "hello",
		});
		expect(await action.execute({ value: "hello" })).toEqual({
			ok: true,
			params: { value: "hello" },
		});
	});
});

describe("AdapterManifest", () => {
	it("accepts an actions map", () => {
		const manifest: AdapterManifest = {
			name: "test-adapter",
			version: "1.0.0",
			nativeDeps: [],
			capabilities: [],
			actions: {
				myAction: {
					name: "myAction",
					description: "does a thing",
					paramsSchema: z.object({}),
					validate: async (params) => params,
					execute: async () => ({ done: true }),
				},
			},
		};

		expect(manifest.actions).toBeDefined();
		expect(manifest.actions?.myAction.name).toBe("myAction");
	});

	it("still works without actions", () => {
		const manifest: AdapterManifest = {
			name: "test-adapter",
			version: "1.0.0",
			nativeDeps: [],
			capabilities: [],
		};

		expect(manifest.actions).toBeUndefined();
	});
});

describe("ApprovalEngineInterface", () => {
	it("can be implemented", async () => {
		const engine: ApprovalEngineInterface = {
			propose: async (input) => ({
				id: "proposal-1",
				status: "pending",
			}),
		};

		const result = await engine.propose({
			adapter: "test",
			action: "myAction",
			params: { key: "value" },
		});

		expect(result.id).toBe("proposal-1");
		expect(result.status).toBe("pending");
	});
});
