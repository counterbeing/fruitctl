import { describe, it, expect, vi } from "vitest";
import { createServer } from "../server.js";
import { registerAdapters } from "../registry.js";
import { createDatabase } from "@fruitctl/db";
import type { AdapterPlugin, AdapterPluginOptions } from "../adapter.js";
import type { FastifyPluginAsync } from "fastify";

function createTestRemindersAdapter(): AdapterPlugin {
  const plugin: FastifyPluginAsync<AdapterPluginOptions & { _mockExec?: any }> = async (fastify, opts) => {
    fastify.get("/lists", async () => ({
      items: [{ id: "list-1", title: "Groceries" }],
    }));
    fastify.post("/list", async (request) => ({
      items: [{ id: "r-1", title: "Milk", completed: false }],
    }));
  };

  return Object.assign(plugin, {
    manifest: {
      name: "reminders",
      version: "0.1.0",
      nativeDeps: [{ name: "remindctl", check: async () => true }],
      capabilities: [
        { name: "list_lists", description: "List lists", requiresApproval: false, paramsSchema: {} as any },
      ],
    },
  });
}

describe("integration: server + adapter", () => {
  it("boots server, registers adapter, serves requests", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test-secret-long-enough" });
    const adapter = createTestRemindersAdapter();

    await registerAdapters(server, [adapter], { db, config: {} });

    // Health check works
    const health = await server.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    // Adapter route works
    const lists = await server.inject({ method: "GET", url: "/reminders/lists" });
    expect(lists.statusCode).toBe(200);
    expect(lists.json().items).toHaveLength(1);
    expect(lists.json().items[0].title).toBe("Groceries");
  });
});
