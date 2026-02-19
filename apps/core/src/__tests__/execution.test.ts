import { createDatabase } from "@fruitctl/db";
import { auditLog } from "@fruitctl/db";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ApprovalEngine } from "../approval.js";
import type { ActionRegistry } from "../approval.js";

const migrationsFolder = resolve(
	import.meta.dirname,
	"../../../../packages/db/drizzle",
);

function setup(options?: { registry?: ActionRegistry }) {
	const db = createDatabase(":memory:");
	migrate(db, { migrationsFolder });
	const engine = new ApprovalEngine(db, options);
	return { db, engine };
}

describe("proposal execution", () => {
	it("executes the action on approval when registry is set", async () => {
		const executeFn = vi.fn().mockResolvedValue({ id: "new-reminder" });
		const registry: ActionRegistry = {
			getAction: () => ({ execute: executeFn }),
		};
		const { db, engine } = setup({ registry });

		const { id } = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		await engine.approve(id, "cli");

		expect(executeFn).toHaveBeenCalledWith({ title: "Milk" });

		// Check audit log
		const logs = db
			.select()
			.from(auditLog)
			.where(eq(auditLog.proposalId, id))
			.all();
		expect(logs).toHaveLength(1);
		expect(logs[0].result).toContain("new-reminder");
	});

	it("logs errors when execution fails", async () => {
		const registry: ActionRegistry = {
			getAction: () => ({
				execute: async () => {
					throw new Error("remindctl failed");
				},
			}),
		};
		const { db, engine } = setup({ registry });

		const { id } = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: {},
		});
		const result = await engine.approve(id, "cli");
		expect(result.status).toBe("approved");

		const logs = db
			.select()
			.from(auditLog)
			.where(eq(auditLog.proposalId, id))
			.all();
		expect(logs).toHaveLength(1);
		expect(logs[0].error).toContain("remindctl failed");
	});

	it("skips execution when no registry is configured", async () => {
		const { engine } = setup();
		const { id } = await engine.propose({
			adapter: "r",
			action: "add",
			params: {},
		});
		const result = await engine.approve(id, "cli");
		expect(result.status).toBe("approved");
	});

	it("skips execution when action not found in registry", async () => {
		const registry: ActionRegistry = {
			getAction: () => undefined,
		};
		const { engine } = setup({ registry });
		const { id } = await engine.propose({
			adapter: "r",
			action: "add",
			params: {},
		});
		const result = await engine.approve(id, "cli");
		expect(result.status).toBe("approved");
	});
});
