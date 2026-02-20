import { describe, expect, it } from "vitest";
import { deriveKey } from "../auth.js";

describe("deriveKey", () => {
  it("derives a deterministic key with prefix", () => {
    const key = deriveKey("admin", "my-test-secret-1234");
    expect(key).toMatch(/^fctl_admin_[0-9a-f]{64}$/);
  });

  it("returns the same key for the same inputs", () => {
    const a = deriveKey("agent", "my-test-secret-1234");
    const b = deriveKey("agent", "my-test-secret-1234");
    expect(a).toBe(b);
  });

  it("returns different keys for different roles", () => {
    const admin = deriveKey("admin", "my-test-secret-1234");
    const agent = deriveKey("agent", "my-test-secret-1234");
    expect(admin).not.toBe(agent);
  });

  it("returns different keys for different secrets", () => {
    const a = deriveKey("admin", "my-test-secret-1234");
    const b = deriveKey("admin", "other-secret-56789");
    expect(a).not.toBe(b);
  });
});
