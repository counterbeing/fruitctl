import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../connection.js";
import { auditLog, proposals } from "../schema.js";

function setupDb() {
  const db = createDatabase(":memory:");
  migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

describe("proposals table", () => {
  it("inserts and retrieves a proposal", () => {
    const db = setupDb();

    db.insert(proposals)
      .values({
        id: "prop-1",
        adapter: "screen-time",
        action: "grant",
        params: JSON.stringify({ app: "Safari", duration: 30 }),
        status: "pending",
      })
      .run();

    const row = db
      .select()
      .from(proposals)
      .where(eq(proposals.id, "prop-1"))
      .get();

    expect(row).toBeDefined();
    expect(row!.adapter).toBe("screen-time");
    expect(row!.action).toBe("grant");
    expect(row!.status).toBe("pending");
    expect(JSON.parse(row!.params)).toEqual({ app: "Safari", duration: 30 });
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.resolvedAt).toBeNull();
    expect(row!.resolvedBy).toBeNull();
  });
});

describe("audit_log table", () => {
  it("inserts and retrieves an audit log entry with foreign key to proposals", () => {
    const db = setupDb();

    db.insert(proposals)
      .values({
        id: "prop-2",
        adapter: "screen-time",
        action: "grant",
        params: JSON.stringify({ app: "Chrome" }),
        status: "executed",
      })
      .run();

    db.insert(auditLog)
      .values({
        id: "log-1",
        proposalId: "prop-2",
        adapter: "screen-time",
        action: "grant",
        params: JSON.stringify({ app: "Chrome" }),
        result: JSON.stringify({ success: true }),
      })
      .run();

    const row = db
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, "log-1"))
      .get();

    expect(row).toBeDefined();
    expect(row!.proposalId).toBe("prop-2");
    expect(row!.adapter).toBe("screen-time");
    expect(row!.action).toBe("grant");
    expect(JSON.parse(row!.result!)).toEqual({ success: true });
    expect(row!.error).toBeNull();
    expect(row!.timestamp).toBeInstanceOf(Date);
  });
});
