import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  const testDir = join(tmpdir(), `fruitctl-config-test-${Date.now()}`);
  const credsPath = join(testDir, "credentials.json");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("loads config from env vars", () => {
    const config = loadConfig(
      {
        FRUITCTL_SECRET: "a-very-long-secret-key",
        FRUITCTL_PORT: "4000",
      },
      credsPath,
    );
    expect(config.port).toBe(4000);
    expect(config.host).toBe("0.0.0.0");
    expect(config.secret).toBe("a-very-long-secret-key");
  });

  it("throws when secret is missing from both env and credentials", () => {
    expect(() => loadConfig({}, credsPath)).toThrow();
  });

  it("throws when secret is too short", () => {
    expect(() => loadConfig({ FRUITCTL_SECRET: "short" }, credsPath)).toThrow();
  });

  it("falls back to credentials file when env var is missing", () => {
    writeFileSync(
      credsPath,
      JSON.stringify({
        mode: "server",
        secret: "creds-file-secret-12345",
        adminKey: "fctl_admin_abc",
        agentKey: "fctl_agent_def",
        serverUrl: "http://127.0.0.1:3456",
      }),
    );
    const config = loadConfig({}, credsPath);
    expect(config.secret).toBe("creds-file-secret-12345");
  });

  it("env var takes priority over credentials file", () => {
    writeFileSync(
      credsPath,
      JSON.stringify({
        mode: "server",
        secret: "creds-file-secret-12345",
        adminKey: "fctl_admin_abc",
        agentKey: "fctl_agent_def",
        serverUrl: "http://127.0.0.1:3456",
      }),
    );
    const config = loadConfig(
      { FRUITCTL_SECRET: "env-var-secret-67890123" },
      credsPath,
    );
    expect(config.secret).toBe("env-var-secret-67890123");
  });

  it("ignores credentials file when mode is not server", () => {
    writeFileSync(
      credsPath,
      JSON.stringify({
        mode: "agent",
        secret: "creds-file-secret-12345",
        serverUrl: "http://127.0.0.1:3456",
      }),
    );
    expect(() => loadConfig({}, credsPath)).toThrow();
  });
});
