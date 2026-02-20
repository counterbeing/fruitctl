import { createDatabase } from "@fruitctl/db";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ApprovalEngine } from "../approval.js";
import { deriveKey } from "../auth.js";
import { registerProposalRoutes } from "../proposals-routes.js";
import { createServer } from "../server.js";

const SECRET = "test-secret-long-enough";
const ADMIN_KEY = deriveKey("admin", SECRET);
const AGENT_KEY = deriveKey("agent", SECRET);

const migrationsFolder = resolve(
	import.meta.dirname,
	"../../../../packages/db/drizzle",
);

function buildApp() {
	const db = createDatabase(":memory:");
	migrate(db, { migrationsFolder });
	const engine = new ApprovalEngine(db);
	const server = createServer({ db, secret: SECRET });
	registerProposalRoutes(server, engine);
	return { server, engine };
}

function authHeader(key: string) {
	return { authorization: `Bearer ${key}` };
}

describe("proposal routes", () => {
	it("GET /proposals returns 401 without auth", async () => {
		const { server } = buildApp();
		const res = await server.inject({ method: "GET", url: "/proposals" });
		expect(res.statusCode).toBe(401);
	});

	it("GET /proposals works with agent key", async () => {
		const { server, engine } = buildApp();
		await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "GET",
			url: "/proposals",
			headers: authHeader(AGENT_KEY),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().items).toHaveLength(1);
	});

	it("GET /proposals works with admin key", async () => {
		const { server, engine } = buildApp();
		await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "GET",
			url: "/proposals",
			headers: authHeader(ADMIN_KEY),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().items).toHaveLength(1);
	});

	it("POST /proposals/:id/approve requires admin key", async () => {
		const { server, engine } = buildApp();
		const proposal = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "POST",
			url: `/proposals/${proposal.id}/approve`,
			headers: authHeader(AGENT_KEY),
		});
		expect(res.statusCode).toBe(403);
	});

	it("POST /proposals/:id/approve works with admin key", async () => {
		const { server, engine } = buildApp();
		const proposal = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "POST",
			url: `/proposals/${proposal.id}/approve`,
			headers: authHeader(ADMIN_KEY),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().status).toBe("approved");
	});

	it("POST /proposals/:id/reject requires admin key", async () => {
		const { server, engine } = buildApp();
		const proposal = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "POST",
			url: `/proposals/${proposal.id}/reject`,
			headers: authHeader(AGENT_KEY),
		});
		expect(res.statusCode).toBe(403);
	});

	it("POST /proposals/:id/reject works with admin key", async () => {
		const { server, engine } = buildApp();
		const proposal = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "POST",
			url: `/proposals/${proposal.id}/reject`,
			headers: authHeader(ADMIN_KEY),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().status).toBe("rejected");
	});

	it("GET /proposals/:id works with agent key", async () => {
		const { server, engine } = buildApp();
		const proposal = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "GET",
			url: `/proposals/${proposal.id}`,
			headers: authHeader(AGENT_KEY),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().adapter).toBe("reminders");
	});

	it("GET /proposals?status=pending filters results", async () => {
		const { server, engine } = buildApp();
		await engine.propose({ adapter: "r", action: "add", params: {} });
		const { id } = await engine.propose({
			adapter: "r",
			action: "edit",
			params: {},
		});
		await engine.reject(id, "test");
		const res = await server.inject({
			method: "GET",
			url: "/proposals?status=pending",
			headers: authHeader(ADMIN_KEY),
		});
		expect(res.json().items).toHaveLength(1);
	});
});
