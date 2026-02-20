import { resolve } from "node:path";
import { createDatabase } from "@fruitctl/db";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { ApprovalEngine } from "../approval.js";
import { registerProposalRoutes } from "../proposals-routes.js";
import { createServer } from "../server.js";

const migrationsFolder = resolve(
  import.meta.dirname,
  "../../../../packages/db/drizzle",
);

function buildApp() {
  const db = createDatabase(":memory:");
  migrate(db, { migrationsFolder });
  const engine = new ApprovalEngine(db);
  const server = createServer({ db, jwtSecret: "test-secret-long-enough" });
  registerProposalRoutes(server, engine);
  return { server, engine };
}

describe("proposal routes", () => {
  it("GET /proposals returns all proposals", async () => {
    const { server, engine } = buildApp();
    await engine.propose({
      adapter: "reminders",
      action: "add",
      params: { title: "Milk" },
    });

    const res = await server.inject({
      method: "GET",
      url: "/proposals",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
  });

  it("POST /proposals/:id/approve resolves proposal", async () => {
    const { server, engine } = buildApp();
    const proposal = await engine.propose({
      adapter: "reminders",
      action: "add",
      params: { title: "Milk" },
    });

    const res = await server.inject({
      method: "POST",
      url: `/proposals/${proposal.id}/approve`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("approved");
  });

  it("POST /proposals/:id/reject resolves proposal", async () => {
    const { server, engine } = buildApp();
    const proposal = await engine.propose({
      adapter: "reminders",
      action: "add",
      params: { title: "Milk" },
    });

    const res = await server.inject({
      method: "POST",
      url: `/proposals/${proposal.id}/reject`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("rejected");
  });

  it("GET /proposals/:id returns a single proposal", async () => {
    const { server, engine } = buildApp();
    const proposal = await engine.propose({
      adapter: "reminders",
      action: "add",
      params: { title: "Milk" },
    });

    const res = await server.inject({
      method: "GET",
      url: `/proposals/${proposal.id}`,
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
    });
    expect(res.json().items).toHaveLength(1);
  });
});
