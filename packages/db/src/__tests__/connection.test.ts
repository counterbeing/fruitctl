import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../connection.js";

describe("createDatabase", () => {
  it("returns a drizzle instance connected to an in-memory database", () => {
    const db = createDatabase(":memory:");
    expect(db).toBeDefined();
  });

  it("can execute a raw query", () => {
    const db = createDatabase(":memory:");
    const result = db.get<{ value: number }>(sql`SELECT 1 as value`);
    expect(result).toBeDefined();
    expect(result?.value).toBe(1);
  });
});
