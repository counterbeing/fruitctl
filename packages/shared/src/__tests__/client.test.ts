import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type ClientCredentials,
  loadCredentials,
  type ServerCredentials,
  saveCredentials,
} from "../client.js";

describe("credentials", () => {
  const testDir = join(tmpdir(), `fruitctl-test-${Date.now()}`);
  const credsPath = join(testDir, "credentials.json");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("saves and loads server credentials", () => {
    const creds: ServerCredentials = {
      mode: "server",
      secret: "test-secret-1234567890",
      adminKey: "fctl_admin_abc",
      agentKey: "fctl_agent_def",
      serverUrl: "http://127.0.0.1:3456",
    };
    saveCredentials(creds, credsPath);
    const loaded = loadCredentials(credsPath);
    expect(loaded).toEqual({ ...creds, token: creds.adminKey });
  });

  it("saves and loads client credentials", () => {
    const creds: ClientCredentials = {
      mode: "client",
      token: "fctl_agent_def",
      serverUrl: "http://192.168.1.10:3456",
    };
    saveCredentials(creds, credsPath);
    const loaded = loadCredentials(credsPath);
    expect(loaded).toEqual(creds);
  });

  it("resolves token from server credentials (uses adminKey)", () => {
    const creds: ServerCredentials = {
      mode: "server",
      secret: "test-secret-1234567890",
      adminKey: "fctl_admin_abc",
      agentKey: "fctl_agent_def",
      serverUrl: "http://127.0.0.1:3456",
    };
    saveCredentials(creds, credsPath);
    const loaded = loadCredentials(credsPath);
    expect(loaded.token).toBe("fctl_admin_abc");
    expect(loaded.serverUrl).toBe("http://127.0.0.1:3456");
  });

  it("resolves token from client credentials", () => {
    const creds: ClientCredentials = {
      mode: "client",
      token: "fctl_agent_def",
      serverUrl: "http://192.168.1.10:3456",
    };
    saveCredentials(creds, credsPath);
    const loaded = loadCredentials(credsPath);
    expect(loaded.token).toBe("fctl_agent_def");
    expect(loaded.serverUrl).toBe("http://192.168.1.10:3456");
  });

  it("throws when credentials file does not exist", () => {
    expect(() => loadCredentials(join(testDir, "nonexistent.json"))).toThrow();
  });
});
