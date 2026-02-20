import { createDatabase } from "@fruitctl/db";
import type { AdapterPlugin } from "@fruitctl/shared";
import { describe, expect, it } from "vitest";
import { deriveKey } from "../auth.js";
import { registerAdapters } from "../registry.js";
import { createServer } from "../server.js";

const SECRET = "test-secret-long-enough";
const ADMIN_KEY = deriveKey("admin", SECRET);

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
    const server = createServer({ db, secret: SECRET });
    const adapter = createMockAdapter("reminders");

    const result = await registerAdapters(server, [adapter], {
      db,
      config: {},
      approval: { propose: async () => ({ id: "mock", status: "approved" }) },
    });

    expect(result.registered).toContain("reminders");
    const res = await server.inject({
      method: "GET",
      url: "/reminders/ping",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ adapter: "reminders" });
  });

  it("skips adapter when native dep check fails", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, secret: SECRET });
    const adapter = createMockAdapter("broken", false);

    const result = await registerAdapters(server, [adapter], {
      db,
      config: {},
      approval: { propose: async () => ({ id: "mock", status: "approved" }) },
    });

    expect(result.registered).not.toContain("broken");
    expect(result.skipped).toContain("broken");
  });

  it("aggregates capabilities from all registered adapters", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, secret: SECRET });
    const a1 = createMockAdapter("reminders");
    const a2 = createMockAdapter("things");

    const result = await registerAdapters(server, [a1, a2], {
      db,
      config: {},
      approval: { propose: async () => ({ id: "mock", status: "approved" }) },
    });

    expect(result.capabilities).toHaveLength(2);
    expect(result.capabilities.map((c) => c.name)).toEqual([
      "list_reminders",
      "list_things",
    ]);
  });

  it("adapter routes require authentication", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, secret: SECRET });
    const adapter = createMockAdapter("reminders");

    await registerAdapters(server, [adapter], {
      db,
      config: {},
      approval: { propose: async () => ({ id: "mock", status: "approved" }) },
    });

    const res = await server.inject({
      method: "GET",
      url: "/reminders/ping",
    });
    expect(res.statusCode).toBe(401);
  });
});
