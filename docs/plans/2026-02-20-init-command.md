# Init Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the multi-step manual setup with a single `fruitctl init` command that generates credentials (server mode) or configures a client (client mode).

**Architecture:** The credentials file at `~/.config/fruitctl/credentials.json` gets a richer schema with `mode: "server"|"client"`. The `loadCredentials()` function resolves the active token based on mode. Server config falls back to reading the secret from the credentials file when the env var is missing.

**Tech Stack:** TypeScript, Commander, Node crypto, Zod 4, Vitest

---

### Task 1: Update Credentials Types and Save/Load in `@fruitctl/shared`

**Files:**
- Modify: `packages/shared/src/client.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/__tests__/client.test.ts`:

```typescript
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadCredentials,
  saveCredentials,
  type ServerCredentials,
  type ClientCredentials,
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
    expect(loaded).toEqual(creds);
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
    // loadCredentials should always return { token, serverUrl } for apiRequest compatibility
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @fruitctl/shared exec vitest run src/__tests__/client.test.ts`
Expected: FAIL — `ServerCredentials` and `ClientCredentials` types don't exist yet, `saveCredentials`/`loadCredentials` don't accept path params.

**Step 3: Write minimal implementation**

Update `packages/shared/src/client.ts`:

```typescript
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const CONFIG_DIR = join(homedir(), ".config", "fruitctl");
const CREDS_PATH = join(CONFIG_DIR, "credentials.json");

export interface ServerCredentials {
  mode: "server";
  secret: string;
  adminKey: string;
  agentKey: string;
  serverUrl: string;
}

export interface ClientCredentials {
  mode: "client";
  token: string;
  serverUrl: string;
}

export type Credentials = ServerCredentials | ClientCredentials;

/** Resolved credentials for API requests. */
interface ResolvedCredentials {
  token: string;
  serverUrl: string;
}

export function saveCredentials(
  creds: Credentials,
  path: string = CREDS_PATH,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(creds, null, 2));
}

export function loadCredentials(
  path: string = CREDS_PATH,
): Credentials & ResolvedCredentials {
  const raw = readFileSync(path, "utf-8");
  const creds: Credentials = JSON.parse(raw);
  if (creds.mode === "server") {
    return { ...creds, token: creds.adminKey };
  }
  return creds;
}

export function credentialsPath(): string {
  return CREDS_PATH;
}

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const { token, serverUrl } = loadCredentials();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = (data as any).error;
    throw new Error(
      `[${err?.code ?? res.status}] ${err?.message ?? "Request failed"}`,
    );
  }
  return data;
}
```

**Step 4: Update exports in `packages/shared/src/index.ts`**

Add the new types to exports:

```typescript
export * from "./adapter.js";
export { deriveKey, type Role } from "./auth.js";
export * from "./client.js";
export * from "./errors.js";
```

No change needed — the `*` re-export already picks up new named exports.

**Step 5: Run test to verify it passes**

Run: `pnpm --filter @fruitctl/shared exec vitest run src/__tests__/client.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/shared/src/client.ts packages/shared/src/__tests__/client.test.ts
git commit -m "feat: add server/client credential modes to shared client"
```

---

### Task 2: Create `fruitctl init` Command

**Files:**
- Create: `apps/cli/src/commands/init.ts`
- Modify: `apps/cli/src/index.ts`
- Delete: `apps/cli/src/commands/auth.ts`

**Step 1: Write the init command**

Create `apps/cli/src/commands/init.ts`:

```typescript
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import {
  deriveKey,
  saveCredentials,
  credentialsPath,
  type ServerCredentials,
  type ClientCredentials,
} from "@fruitctl/shared";
import { Command } from "commander";

export const initCommand = new Command("init")
  .description("Initialize fruitctl credentials")
  .option("--client <token>", "Initialize as a client with the given API key")
  .option("--server <url>", "Server URL")
  .option("--force", "Overwrite existing credentials")
  .action(async (opts) => {
    const path = credentialsPath();

    if (existsSync(path) && !opts.force) {
      console.error(
        `Credentials already exist at ${path}\nUse --force to overwrite.`,
      );
      process.exit(1);
    }

    if (opts.client) {
      // Client mode
      if (!opts.server) {
        console.error("Error: --server <url> is required in client mode");
        process.exit(1);
      }
      const creds: ClientCredentials = {
        mode: "client",
        token: opts.client,
        serverUrl: opts.server,
      };
      saveCredentials(creds);
      console.log(`Client credentials saved to ${path}`);
    } else {
      // Server mode
      const secret = randomBytes(32).toString("base64");
      const adminKey = deriveKey("admin", secret);
      const agentKey = deriveKey("agent", secret);
      const serverUrl = opts.server ?? "http://127.0.0.1:3456";

      const creds: ServerCredentials = {
        mode: "server",
        secret,
        adminKey,
        agentKey,
        serverUrl,
      };
      saveCredentials(creds);

      console.log("Initialized fruitctl server credentials.\n");
      console.log(`  Admin key: ${adminKey}`);
      console.log(`  Agent key: ${agentKey}\n`);
      console.log(`Credentials saved to ${path}\n`);
      console.log("To configure a client, run on the client machine:");
      console.log(
        `  fruitctl init --client <agent-key> --server ${serverUrl}`,
      );
    }
  });
```

**Step 2: Update CLI entry point**

Modify `apps/cli/src/index.ts` — replace `authCommand` with `initCommand`:

```typescript
#!/usr/bin/env node
import { calendarCommand } from "@fruitctl/calendar";
import { remindersCommand } from "@fruitctl/reminders";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { proposalsCommand } from "./commands/proposals.js";
import { serverCommand } from "./commands/server.js";

const program = new Command();

program
  .name("fruitctl")
  .description("Local Apple Integration Gateway CLI")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(calendarCommand);
program.addCommand(serverCommand);
program.addCommand(remindersCommand);
program.addCommand(proposalsCommand);

program.parse();
```

**Step 3: Delete `apps/cli/src/commands/auth.ts`**

Remove the old auth command file.

**Step 4: Build and verify**

Run: `pnpm build`
Expected: PASS — no compile errors.

**Step 5: Commit**

```bash
git add apps/cli/src/commands/init.ts apps/cli/src/index.ts
git rm apps/cli/src/commands/auth.ts
git commit -m "feat: replace auth token command with fruitctl init"
```

---

### Task 3: Server Config Fallback to Credentials File

**Files:**
- Modify: `apps/core/src/config.ts`

**Step 1: Write the failing test**

Create `apps/core/src/__tests__/config.test.ts`:

```typescript
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  it("loads secret from env var", () => {
    const config = loadConfig({ FRUITCTL_SECRET: "test-secret-1234567890" });
    expect(config.secret).toBe("test-secret-1234567890");
  });

  it("falls back to credentials file when env var is missing", () => {
    const testDir = join(tmpdir(), `fruitctl-config-test-${Date.now()}`);
    const credsPath = join(testDir, "credentials.json");
    mkdirSync(testDir, { recursive: true });
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

    try {
      const config = loadConfig({}, credsPath);
      expect(config.secret).toBe("creds-file-secret-12345");
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("env var takes priority over credentials file", () => {
    const testDir = join(tmpdir(), `fruitctl-config-test-${Date.now()}`);
    const credsPath = join(testDir, "credentials.json");
    mkdirSync(testDir, { recursive: true });
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

    try {
      const config = loadConfig(
        { FRUITCTL_SECRET: "env-var-secret-67890" },
        credsPath,
      );
      expect(config.secret).toBe("env-var-secret-67890");
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @fruitctl/core exec vitest run src/__tests__/config.test.ts`
Expected: FAIL — `loadConfig` doesn't accept a `credsPath` parameter yet.

**Step 3: Write minimal implementation**

Update `apps/core/src/config.ts`:

```typescript
import { readFileSync } from "node:fs";
import { z } from "zod/v4";
import { credentialsPath } from "@fruitctl/shared";

export const serverConfigSchema = z.object({
  port: z.number().default(3456),
  host: z.string().default("127.0.0.1"),
  secret: z.string().min(16),
  dbPath: z.string().default("./fruitctl.db"),
  adapters: z.array(z.string()).default(["reminders", "calendar"]),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

function readSecretFromCredentials(path: string): string | undefined {
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw);
    if (data.mode === "server" && typeof data.secret === "string") {
      return data.secret;
    }
  } catch {
    // File doesn't exist or is invalid — fall through
  }
  return undefined;
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
  credsPath: string = credentialsPath(),
): ServerConfig {
  const secret = env.FRUITCTL_SECRET ?? readSecretFromCredentials(credsPath);

  return serverConfigSchema.parse({
    port: env.FRUITCTL_PORT ? Number(env.FRUITCTL_PORT) : undefined,
    host: env.FRUITCTL_HOST ?? undefined,
    secret,
    dbPath: env.FRUITCTL_DB_PATH ?? undefined,
    adapters: env.FRUITCTL_ADAPTERS?.split(",") ?? undefined,
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @fruitctl/core exec vitest run src/__tests__/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/core/src/config.ts apps/core/src/__tests__/config.test.ts
git commit -m "feat: loadConfig falls back to credentials file for secret"
```

---

### Task 4: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README.md**

Replace the Setup section:

```markdown
## Setup

### Initialize the server

```bash
fruitctl init
```

This generates a secret and API keys, saving them to `~/.config/fruitctl/credentials.json`. The admin and agent keys are printed to stdout.

### Start the server

```bash
fruitctl server start
```

The server reads the secret from the credentials file automatically — no env vars needed.

### Configure a client

On a different machine (or for agent-only access), use the agent key from the init output:

```bash
fruitctl init --client <agent-key> --server http://<server-host>:3456
```

### Open the dashboard

Visit `http://localhost:3456` and paste your admin key.
```

**Step 2: Update CLAUDE.md**

Change the env vars line to reflect that `FRUITCTL_SECRET` is optional (falls back to credentials file):

```
**Env vars for dev server:** `FRUITCTL_SECRET` (optional if `fruitctl init` was run; env var overrides credentials file), `FRUITCTL_PORT` (default 3456), `FRUITCTL_HOST` (default 127.0.0.1), `FRUITCTL_DB_PATH` (default `./fruitctl.db`), `FRUITCTL_ADAPTERS` (comma-separated, default `reminders,calendar`).
```

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update setup instructions for fruitctl init"
```

---

### Task 5: Run Full Test Suite

**Step 1: Build everything**

Run: `pnpm build`
Expected: PASS

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All 71+ tests pass (plus new ones from tasks 1 and 3).

**Step 3: Lint**

Run: `pnpm lint`
Expected: PASS
