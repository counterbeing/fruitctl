import { createDatabase } from "@fruitctl/db";
import { proposals } from "@fruitctl/db";
import { AppError, ErrorCode } from "@fruitctl/shared";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ApprovalEngine } from "../approval.js";

const migrationsFolder = resolve(
	import.meta.dirname,
	"../../../../packages/db/drizzle",
);

function setup() {
	const db = createDatabase(":memory:");
	migrate(db, { migrationsFolder });
	const engine = new ApprovalEngine(db);
	return { db, engine };
}

describe("ApprovalEngine", () => {
	it("creates a pending proposal", async () => {
		const { engine } = setup();
		const proposal = await engine.propose({
			adapter: "reminders",
			action: "create",
			params: { title: "Buy milk" },
		});

		expect(proposal.id).toBeDefined();
		expect(proposal.adapter).toBe("reminders");
		expect(proposal.action).toBe("create");
		expect(proposal.params).toEqual({ title: "Buy milk" });
		expect(proposal.status).toBe("pending");
		expect(proposal.createdAt).toBeInstanceOf(Date);
		expect(proposal.resolvedAt).toBeNull();
		expect(proposal.resolvedBy).toBeNull();
	});

	it("approves a pending proposal", async () => {
		const { engine } = setup();
		const created = await engine.propose({
			adapter: "reminders",
			action: "create",
			params: { title: "Test" },
		});

		const approved = await engine.approve(created.id, "user@test.com");

		expect(approved.status).toBe("approved");
		expect(approved.resolvedBy).toBe("user@test.com");
		expect(approved.resolvedAt).toBeInstanceOf(Date);
	});

	it("rejects a pending proposal", async () => {
		const { engine } = setup();
		const created = await engine.propose({
			adapter: "reminders",
			action: "delete",
			params: { id: "abc" },
		});

		const rejected = await engine.reject(created.id, "admin@test.com");

		expect(rejected.status).toBe("rejected");
		expect(rejected.resolvedBy).toBe("admin@test.com");
		expect(rejected.resolvedAt).toBeInstanceOf(Date);
	});

	it("throws PROPOSAL_NOT_FOUND when approving non-existent proposal", async () => {
		const { engine } = setup();

		await expect(
			engine.approve("non-existent-id", "user@test.com"),
		).rejects.toThrow(AppError);

		try {
			await engine.approve("non-existent-id", "user@test.com");
		} catch (err) {
			expect(err).toBeInstanceOf(AppError);
			expect((err as AppError).code).toBe(ErrorCode.PROPOSAL_NOT_FOUND);
		}
	});

	it("throws when approving an already-resolved proposal", async () => {
		const { engine } = setup();
		const created = await engine.propose({
			adapter: "reminders",
			action: "create",
			params: {},
		});

		await engine.approve(created.id, "user@test.com");

		await expect(
			engine.approve(created.id, "another@test.com"),
		).rejects.toThrow(AppError);

		try {
			await engine.approve(created.id, "another@test.com");
		} catch (err) {
			expect(err).toBeInstanceOf(AppError);
			expect((err as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
		}
	});

	it("lists proposals filtered by status", async () => {
		const { engine } = setup();
		await engine.propose({ adapter: "a", action: "x", params: {} });
		const p2 = await engine.propose({ adapter: "b", action: "y", params: {} });
		await engine.propose({ adapter: "c", action: "z", params: {} });

		await engine.approve(p2.id, "user@test.com");

		const pending = await engine.list({ status: "pending" });
		expect(pending).toHaveLength(2);
		expect(pending.every((p) => p.status === "pending")).toBe(true);

		const approved = await engine.list({ status: "approved" });
		expect(approved).toHaveLength(1);
		expect(approved[0].id).toBe(p2.id);

		const all = await engine.list();
		expect(all).toHaveLength(3);
	});

	it("gets a single proposal by id", async () => {
		const { engine } = setup();
		const created = await engine.propose({
			adapter: "reminders",
			action: "create",
			params: { foo: "bar" },
		});

		const fetched = await engine.get(created.id);

		expect(fetched.id).toBe(created.id);
		expect(fetched.adapter).toBe("reminders");
		expect(fetched.params).toEqual({ foo: "bar" });
	});

	it("expires proposals older than TTL", async () => {
		const { db, engine } = setup();
		const p1 = await engine.propose({
			adapter: "a",
			action: "x",
			params: {},
		});
		await engine.propose({ adapter: "b", action: "y", params: {} });

		// Backdate p1 to 2 hours ago
		db.update(proposals)
			.set({ createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) })
			.where(eq(proposals.id, p1.id))
			.run();

		// Expire with 1 hour TTL
		const count = await engine.expireStale(60 * 60 * 1000);

		expect(count).toBe(1);

		const expired = await engine.get(p1.id);
		expect(expired.status).toBe("expired");
	});
});
