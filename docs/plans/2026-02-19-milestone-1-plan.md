# Milestone 1: Core + Read-Only Reminders — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up the fruitctl monorepo with a working Fastify server, adapter plugin system, Reminders read adapter, and CLI — end-to-end read access to Apple Reminders.

**Architecture:** pnpm + Nx monorepo with apps/core (Fastify server), apps/cli (fruitctl binary), packages/db (Drizzle + SQLite), and packages/plugins/reminders (remindctl adapter). JWT auth, structured errors, JSON logging. Adapters are Fastify plugins that register their own routes.

**Tech Stack:** TypeScript, Fastify, Zod, Drizzle ORM, better-sqlite3, Nx, pnpm, Biome, Vitest, Commander (CLI)

**Native dependency:** `remindctl` — install via `brew install steipete/tap/remindctl`, then `remindctl authorize` for Reminders access.

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `nx.json`
- Create: `tsconfig.base.json`
- Create: `biome.json`
- Create: `.gitignore`
- Create: `apps/core/package.json`
- Create: `apps/core/tsconfig.json`
- Create: `apps/core/src/index.ts` (empty placeholder)
- Create: `apps/cli/package.json`
- Create: `apps/cli/tsconfig.json`
- Create: `apps/cli/src/index.ts` (empty placeholder)
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/index.ts` (empty placeholder)
- Create: `packages/plugins/reminders/package.json`
- Create: `packages/plugins/reminders/tsconfig.json`
- Create: `packages/plugins/reminders/src/index.ts` (empty placeholder)

**Step 1: Create root package.json and workspace config**

```json
// package.json
{
  "name": "fruitctl",
  "private": true,
  "scripts": {
    "build": "nx run-many -t build",
    "test": "nx run-many -t test",
    "lint": "biome check .",
    "lint:fix": "biome check --write ."
  },
  "devDependencies": {
    "nx": "^21",
    "typescript": "^5.7",
    "@biomejs/biome": "^1.9"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "packages/plugins/*"
```

```json
// nx.json
{
  "$schema": "https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["{projectRoot}/dist"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

**Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@fruitctl/db": ["./packages/db/src"],
      "@fruitctl/reminders": ["./packages/plugins/reminders/src"]
    }
  }
}
```

**Step 3: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
*.db
*.db-journal
.nx/
.env
```

**Step 5: Create all package directories with package.json, tsconfig.json, and placeholder src/index.ts**

Each sub-package follows the same pattern. Example for `apps/core`:

```json
// apps/core/package.json
{
  "name": "@fruitctl/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "fastify": "^5",
    "@fastify/jwt": "^9",
    "zod": "^3.24",
    "@fruitctl/db": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3",
    "tsx": "^4"
  }
}
```

```json
// apps/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

```ts
// apps/core/src/index.ts
export {};
```

Repeat for:
- `apps/cli` — deps: `commander`, `@fruitctl/db` (no fastify)
- `packages/db` — deps: `drizzle-orm`, `better-sqlite3`, `@types/better-sqlite3`; devDeps: `drizzle-kit`
- `packages/plugins/reminders` — deps: `fastify`, `zod`, `@fruitctl/db`

**Step 6: Install dependencies**

Run: `pnpm install`
Expected: Clean install, all workspaces linked.

**Step 7: Verify build**

Run: `pnpm build`
Expected: All packages compile successfully (empty index.ts files).

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold fruitctl monorepo with pnpm + Nx"
```

---

## Task 2: Database Package (`@fruitctl/db`)

**Files:**
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/connection.ts`
- Create: `packages/db/src/index.ts` (replace placeholder)
- Create: `packages/db/drizzle.config.ts`
- Test: `packages/db/src/__tests__/connection.test.ts`

**Step 1: Write failing test for DB connection**

```ts
// packages/db/src/__tests__/connection.test.ts
import { describe, it, expect } from "vitest";
import { createDatabase } from "../connection.js";

describe("createDatabase", () => {
  it("returns a drizzle instance connected to an in-memory database", () => {
    const db = createDatabase(":memory:");
    expect(db).toBeDefined();
  });

  it("can execute a raw query", () => {
    const db = createDatabase(":memory:");
    const result = db.run(sql`SELECT 1 as value`);
    expect(result).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @fruitctl/db test`
Expected: FAIL — module not found.

**Step 3: Implement schema and connection**

```ts
// packages/db/src/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

```ts
// packages/db/src/connection.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export function createDatabase(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export type AppDatabase = ReturnType<typeof createDatabase>;
```

```ts
// packages/db/src/index.ts
export { createDatabase, type AppDatabase } from "./connection.js";
export * from "./schema.js";
```

```ts
// packages/db/drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @fruitctl/db test`
Expected: PASS

**Step 5: Generate initial migration**

Run: `pnpm --filter @fruitctl/db drizzle-kit generate`
Expected: Migration file created in `packages/db/drizzle/`

**Step 6: Commit**

```bash
git add packages/db
git commit -m "feat(db): add Drizzle schema, connection factory, and initial migration"
```

---

## Task 3: Structured Error Model

**Files:**
- Create: `apps/core/src/errors.ts`
- Test: `apps/core/src/__tests__/errors.test.ts`

**Step 1: Write failing test**

```ts
// apps/core/src/__tests__/errors.test.ts
import { describe, it, expect } from "vitest";
import { AppError, ErrorCode } from "../errors.js";

describe("AppError", () => {
  it("creates a structured error with code and message", () => {
    const err = new AppError(ErrorCode.VALIDATION_ERROR, "Invalid input");
    expect(err.toJSON()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        retryable: false,
        details: {},
      },
    });
  });

  it("supports retryable flag and details", () => {
    const err = new AppError(
      ErrorCode.EXECUTION_FAILED,
      "Timeout",
      { retryable: true, details: { adapter: "reminders" } }
    );
    const json = err.toJSON();
    expect(json.error.retryable).toBe(true);
    expect(json.error.details).toEqual({ adapter: "reminders" });
  });

  it("maps error codes to HTTP status codes", () => {
    expect(new AppError(ErrorCode.VALIDATION_ERROR, "").statusCode).toBe(400);
    expect(new AppError(ErrorCode.NOT_FOUND, "").statusCode).toBe(404);
    expect(new AppError(ErrorCode.LIST_NOT_ALLOWED, "").statusCode).toBe(403);
    expect(new AppError(ErrorCode.EXECUTION_FAILED, "").statusCode).toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @fruitctl/core test`
Expected: FAIL

**Step 3: Implement error model**

```ts
// apps/core/src/errors.ts
export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  LIST_NOT_ALLOWED = "LIST_NOT_ALLOWED",
  CALENDAR_NOT_ALLOWED = "CALENDAR_NOT_ALLOWED",
  PROPOSAL_NOT_FOUND = "PROPOSAL_NOT_FOUND",
  EXECUTION_FAILED = "EXECUTION_FAILED",
  APPROVAL_REQUIRED = "APPROVAL_REQUIRED",
  UNAUTHORIZED = "UNAUTHORIZED",
}

const STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.LIST_NOT_ALLOWED]: 403,
  [ErrorCode.CALENDAR_NOT_ALLOWED]: 403,
  [ErrorCode.PROPOSAL_NOT_FOUND]: 404,
  [ErrorCode.EXECUTION_FAILED]: 500,
  [ErrorCode.APPROVAL_REQUIRED]: 202,
  [ErrorCode.UNAUTHORIZED]: 401,
};

interface AppErrorOptions {
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.code = code;
    this.statusCode = STATUS_MAP[code];
    this.retryable = options.retryable ?? false;
    this.details = options.details ?? {};
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        details: this.details,
      },
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @fruitctl/core test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/core/src/errors.ts apps/core/src/__tests__/errors.test.ts
git commit -m "feat(core): add structured error model with error codes and HTTP status mapping"
```

---

## Task 4: Adapter Contract Types

**Files:**
- Create: `apps/core/src/adapter.ts`

No test for this — it's pure type definitions. Validated implicitly when adapters implement it.

**Step 1: Define the adapter contract**

```ts
// apps/core/src/adapter.ts
import type { FastifyPluginAsync } from "fastify";
import type { ZodSchema } from "zod";
import type { AppDatabase } from "@fruitctl/db";

export interface NativeDep {
  name: string;
  check: () => Promise<boolean>;
}

export interface CapabilityDef {
  name: string;
  description: string;
  requiresApproval: boolean;
  paramsSchema: ZodSchema;
}

export interface AdapterManifest {
  name: string;
  version: string;
  nativeDeps: NativeDep[];
  capabilities: CapabilityDef[];
}

export interface AdapterPluginOptions {
  db: AppDatabase;
  config: Record<string, unknown>;
}

export type AdapterPlugin = FastifyPluginAsync<AdapterPluginOptions> & {
  manifest: AdapterManifest;
};
```

**Step 2: Export from core index**

Update `apps/core/src/index.ts`:

```ts
export * from "./errors.js";
export * from "./adapter.js";
```

**Step 3: Build to verify types compile**

Run: `pnpm --filter @fruitctl/core build`
Expected: Compiles cleanly.

**Step 4: Commit**

```bash
git add apps/core/src/adapter.ts apps/core/src/index.ts
git commit -m "feat(core): define adapter plugin contract types"
```

---

## Task 5: Fastify Server Factory

**Files:**
- Create: `apps/core/src/server.ts`
- Test: `apps/core/src/__tests__/server.test.ts`

**Step 1: Write failing test**

```ts
// apps/core/src/__tests__/server.test.ts
import { describe, it, expect } from "vitest";
import { createServer } from "../server.js";
import { createDatabase } from "@fruitctl/db";

describe("createServer", () => {
  it("creates a fastify instance with health endpoint", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test-secret" });
    const res = await server.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("returns 401 for protected routes without token", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test-secret" });
    // Register a dummy protected route for testing
    server.get("/protected", { preHandler: [server.authenticate] }, async () => {
      return { data: "secret" };
    });
    const res = await server.inject({ method: "GET", url: "/protected" });
    expect(res.statusCode).toBe(401);
  });

  it("allows access with valid JWT", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test-secret" });
    server.get("/protected", { preHandler: [server.authenticate] }, async () => {
      return { data: "secret" };
    });
    const token = server.jwt.sign({ sub: "test" });
    const res = await server.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns structured errors for AppError", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test-secret" });
    const { AppError, ErrorCode } = await import("../errors.js");
    server.get("/fail", async () => {
      throw new AppError(ErrorCode.NOT_FOUND, "Thing not found");
    });
    const res = await server.inject({ method: "GET", url: "/fail" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Thing not found",
        retryable: false,
        details: {},
      },
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @fruitctl/core test`
Expected: FAIL — server module not found.

**Step 3: Implement server factory**

```ts
// apps/core/src/server.ts
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import type { AppDatabase } from "@fruitctl/db";
import { AppError } from "./errors.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

export interface ServerOptions {
  db: AppDatabase;
  jwtSecret: string;
  host?: string;
  port?: number;
  logger?: boolean;
}

export function createServer(options: ServerOptions) {
  const server = Fastify({
    logger: options.logger ?? false,
  });

  server.register(fastifyJwt, { secret: options.jwtSecret });

  server.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or missing token");
    }
  });

  server.get("/health", async () => ({ status: "ok" }));

  server.setErrorHandler(async (error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }
    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        retryable: false,
        details: {},
      },
    });
  });

  return server;
}
```

Note: import `ErrorCode` from `./errors.js` in the actual file.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @fruitctl/core test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/core/src/server.ts apps/core/src/__tests__/server.test.ts
git commit -m "feat(core): add Fastify server factory with JWT auth and structured error handling"
```

---

## Task 6: Adapter Registration System

**Files:**
- Create: `apps/core/src/registry.ts`
- Test: `apps/core/src/__tests__/registry.test.ts`

**Step 1: Write failing test**

```ts
// apps/core/src/__tests__/registry.test.ts
import { describe, it, expect, vi } from "vitest";
import { createServer } from "../server.js";
import { registerAdapters } from "../registry.js";
import { createDatabase } from "@fruitctl/db";
import type { AdapterPlugin } from "../adapter.js";

function createMockAdapter(name: string, depAvailable = true): AdapterPlugin {
  const plugin: AdapterPlugin = async (fastify, opts) => {
    fastify.get("/ping", async () => ({ adapter: name }));
  };
  plugin.manifest = {
    name,
    version: "0.1.0",
    nativeDeps: [
      { name: `${name}-dep`, check: async () => depAvailable },
    ],
    capabilities: [
      {
        name: `list_${name}`,
        description: `List ${name}`,
        requiresApproval: false,
        paramsSchema: {} as any,
      },
    ],
  };
  return plugin;
}

describe("registerAdapters", () => {
  it("registers an adapter and its routes are reachable", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test" });
    const adapter = createMockAdapter("reminders");

    const result = await registerAdapters(server, [adapter], { db, config: {} });

    expect(result.registered).toContain("reminders");
    const res = await server.inject({ method: "GET", url: "/reminders/ping" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ adapter: "reminders" });
  });

  it("skips adapter when native dep check fails", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test" });
    const adapter = createMockAdapter("broken", false);

    const result = await registerAdapters(server, [adapter], { db, config: {} });

    expect(result.registered).not.toContain("broken");
    expect(result.skipped).toContain("broken");
  });

  it("aggregates capabilities from all registered adapters", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test" });
    const a1 = createMockAdapter("reminders");
    const a2 = createMockAdapter("things");

    const result = await registerAdapters(server, [a1, a2], { db, config: {} });

    expect(result.capabilities).toHaveLength(2);
    expect(result.capabilities.map((c) => c.name)).toEqual([
      "list_reminders",
      "list_things",
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @fruitctl/core test`
Expected: FAIL — registry module not found.

**Step 3: Implement registry**

```ts
// apps/core/src/registry.ts
import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "@fruitctl/db";
import type { AdapterPlugin, CapabilityDef } from "./adapter.js";

export interface RegistrationResult {
  registered: string[];
  skipped: string[];
  capabilities: CapabilityDef[];
}

interface RegistrationOptions {
  db: AppDatabase;
  config: Record<string, unknown>;
}

export async function registerAdapters(
  server: FastifyInstance,
  adapters: AdapterPlugin[],
  options: RegistrationOptions,
): Promise<RegistrationResult> {
  const registered: string[] = [];
  const skipped: string[] = [];
  const capabilities: CapabilityDef[] = [];

  for (const adapter of adapters) {
    const { manifest } = adapter;

    const depsOk = await checkDeps(manifest.nativeDeps);
    if (!depsOk) {
      server.log.warn(`Skipping adapter "${manifest.name}": native deps not met`);
      skipped.push(manifest.name);
      continue;
    }

    await server.register(adapter, {
      prefix: `/${manifest.name}`,
      db: options.db,
      config: options.config,
    });

    registered.push(manifest.name);
    capabilities.push(...manifest.capabilities);
  }

  return { registered, skipped, capabilities };
}

async function checkDeps(deps: { name: string; check: () => Promise<boolean> }[]): Promise<boolean> {
  for (const dep of deps) {
    if (!(await dep.check())) return false;
  }
  return true;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @fruitctl/core test`
Expected: PASS

**Step 5: Update core index exports**

```ts
// apps/core/src/index.ts
export * from "./errors.js";
export * from "./adapter.js";
export * from "./server.js";
export * from "./registry.js";
```

**Step 6: Commit**

```bash
git add apps/core/src/registry.ts apps/core/src/__tests__/registry.test.ts apps/core/src/index.ts
git commit -m "feat(core): add adapter registration system with dep checking and capability aggregation"
```

---

## Task 7: Reminders Adapter — Read Operations

**Files:**
- Create: `packages/plugins/reminders/src/remindctl.ts` (shell wrapper)
- Create: `packages/plugins/reminders/src/schemas.ts`
- Create: `packages/plugins/reminders/src/plugin.ts`
- Replace: `packages/plugins/reminders/src/index.ts`
- Test: `packages/plugins/reminders/src/__tests__/remindctl.test.ts`
- Test: `packages/plugins/reminders/src/__tests__/plugin.test.ts`

**Step 1: Write failing test for remindctl wrapper**

```ts
// packages/plugins/reminders/src/__tests__/remindctl.test.ts
import { describe, it, expect, vi } from "vitest";
import { Remindctl } from "../remindctl.js";

// We test with a mock execAsync so tests work without remindctl installed
describe("Remindctl", () => {
  it("parses list output from --json", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([
        { id: "list-1", title: "Groceries" },
        { id: "list-2", title: "Errands" },
      ]),
    });
    const ctl = new Remindctl(mockExec);
    const lists = await ctl.listLists();
    expect(mockExec).toHaveBeenCalledWith("remindctl list --json");
    expect(lists).toEqual([
      { id: "list-1", title: "Groceries" },
      { id: "list-2", title: "Errands" },
    ]);
  });

  it("parses reminders for a specific list", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([
        { id: "r-1", title: "Milk", completed: false },
      ]),
    });
    const ctl = new Remindctl(mockExec);
    const reminders = await ctl.listReminders("Groceries");
    expect(mockExec).toHaveBeenCalledWith('remindctl list "Groceries" --json');
    expect(reminders).toHaveLength(1);
  });

  it("checks if remindctl binary exists", async () => {
    const mockExec = vi.fn().mockResolvedValue({ stdout: "" });
    const ctl = new Remindctl(mockExec);
    const available = await ctl.isAvailable();
    expect(available).toBe(true);
  });

  it("returns false when remindctl not found", async () => {
    const mockExec = vi.fn().mockRejectedValue(new Error("not found"));
    const ctl = new Remindctl(mockExec);
    const available = await ctl.isAvailable();
    expect(available).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @fruitctl/reminders test`
Expected: FAIL

**Step 3: Implement remindctl wrapper**

```ts
// packages/plugins/reminders/src/remindctl.ts
import { exec } from "node:child_process";
import { promisify } from "node:util";

type ExecFn = (cmd: string) => Promise<{ stdout: string }>;

const defaultExec: ExecFn = promisify(exec);

export class Remindctl {
  private exec: ExecFn;

  constructor(execFn?: ExecFn) {
    this.exec = execFn ?? defaultExec;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.exec("remindctl status");
      return true;
    } catch {
      return false;
    }
  }

  async listLists(): Promise<{ id: string; title: string }[]> {
    const { stdout } = await this.exec("remindctl list --json");
    return JSON.parse(stdout);
  }

  async listReminders(list: string): Promise<unknown[]> {
    const { stdout } = await this.exec(`remindctl list "${list}" --json`);
    return JSON.parse(stdout);
  }

  async getReminder(id: string): Promise<unknown> {
    // remindctl doesn't have a get-by-id — we filter from list
    // This may need revision once we confirm remindctl's exact API
    const { stdout } = await this.exec(`remindctl all --json`);
    const all = JSON.parse(stdout);
    const found = all.find((r: any) => r.id === id);
    if (!found) return null;
    return found;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @fruitctl/reminders test`
Expected: PASS

**Step 5: Write Zod schemas**

```ts
// packages/plugins/reminders/src/schemas.ts
import { z } from "zod";

export const listRemindersSchema = z.object({
  list: z.string().min(1).max(200),
});

export const getReminderSchema = z.object({
  id: z.string().min(1),
});
```

**Step 6: Write failing test for plugin routes**

```ts
// packages/plugins/reminders/src/__tests__/plugin.test.ts
import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { remindersPlugin } from "../plugin.js";
import { createDatabase } from "@fruitctl/db";

const mockReminders = [
  { id: "r-1", title: "Milk", completed: false },
  { id: "r-2", title: "Eggs", completed: true },
];

const mockLists = [
  { id: "list-1", title: "Groceries" },
  { id: "list-2", title: "Errands" },
];

describe("reminders plugin", () => {
  function buildServer() {
    const server = Fastify();
    const db = createDatabase(":memory:");
    server.register(remindersPlugin, {
      db,
      config: {},
      _mockExec: vi.fn().mockImplementation(async (cmd: string) => {
        if (cmd === "remindctl list --json") {
          return { stdout: JSON.stringify(mockLists) };
        }
        if (cmd.startsWith("remindctl list ")) {
          return { stdout: JSON.stringify(mockReminders) };
        }
        if (cmd.startsWith("remindctl all")) {
          return { stdout: JSON.stringify(mockReminders) };
        }
        return { stdout: "[]" };
      }),
    });
    return server;
  }

  it("GET /lists returns all reminder lists", async () => {
    const server = buildServer();
    const res = await server.inject({ method: "GET", url: "/lists" });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual(mockLists);
  });

  it("POST /list returns reminders for a specific list", async () => {
    const server = buildServer();
    const res = await server.inject({
      method: "POST",
      url: "/list",
      payload: { list: "Groceries" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual(mockReminders);
  });

  it("POST /list rejects invalid payload", async () => {
    const server = buildServer();
    const res = await server.inject({
      method: "POST",
      url: "/list",
      payload: { list: "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /get returns a specific reminder", async () => {
    const server = buildServer();
    const res = await server.inject({
      method: "POST",
      url: "/get",
      payload: { id: "r-1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().item.id).toBe("r-1");
  });

  it("POST /get returns 404 for unknown reminder", async () => {
    const server = buildServer();
    const res = await server.inject({
      method: "POST",
      url: "/get",
      payload: { id: "nonexistent" },
    });
    expect(res.statusCode).toBe(404);
  });
});
```

**Step 7: Run test to verify it fails**

Run: `pnpm --filter @fruitctl/reminders test`
Expected: FAIL — plugin module not found.

**Step 8: Implement plugin**

```ts
// packages/plugins/reminders/src/plugin.ts
import type { FastifyPluginAsync } from "fastify";
import type { AdapterPluginOptions } from "@fruitctl/core";
import { AppError, ErrorCode } from "@fruitctl/core";
import { Remindctl } from "./remindctl.js";
import { listRemindersSchema, getReminderSchema } from "./schemas.js";

interface RemindersPluginOptions extends AdapterPluginOptions {
  _mockExec?: any; // for testing
}

export const remindersPlugin: FastifyPluginAsync<RemindersPluginOptions> = async (
  fastify,
  opts,
) => {
  const ctl = new Remindctl(opts._mockExec);

  fastify.get("/lists", async () => {
    const lists = await ctl.listLists();
    return { items: lists };
  });

  fastify.post("/list", async (request) => {
    const parsed = listRemindersSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
    }
    const reminders = await ctl.listReminders(parsed.data.list);
    return { items: reminders };
  });

  fastify.post("/get", async (request) => {
    const parsed = getReminderSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
    }
    const reminder = await ctl.getReminder(parsed.data.id);
    if (!reminder) {
      throw new AppError(ErrorCode.NOT_FOUND, `Reminder "${parsed.data.id}" not found`);
    }
    return { item: reminder };
  });
};
```

**Step 9: Create adapter index with manifest**

```ts
// packages/plugins/reminders/src/index.ts
import type { AdapterPlugin } from "@fruitctl/core";
import { remindersPlugin } from "./plugin.js";
import { listRemindersSchema, getReminderSchema } from "./schemas.js";
import { Remindctl } from "./remindctl.js";

const ctl = new Remindctl();

export const remindersAdapter: AdapterPlugin = Object.assign(remindersPlugin, {
  manifest: {
    name: "reminders",
    version: "0.1.0",
    nativeDeps: [
      {
        name: "remindctl",
        check: () => ctl.isAvailable(),
      },
    ],
    capabilities: [
      {
        name: "list_lists",
        description: "List all Reminders lists",
        requiresApproval: false,
        paramsSchema: {} as any,
      },
      {
        name: "list_reminders",
        description: "List reminders in a specific list",
        requiresApproval: false,
        paramsSchema: listRemindersSchema,
      },
      {
        name: "get_reminder",
        description: "Get a specific reminder by ID",
        requiresApproval: false,
        paramsSchema: getReminderSchema,
      },
    ],
  },
});
```

**Step 10: Run test to verify it passes**

Run: `pnpm --filter @fruitctl/reminders test`
Expected: PASS

**Step 11: Commit**

```bash
git add packages/plugins/reminders
git commit -m "feat(reminders): add read-only reminders adapter with remindctl wrapper"
```

---

## Task 8: Server Entry Point (Wire It All Together)

**Files:**
- Create: `apps/core/src/main.ts`
- Create: `apps/core/src/config.ts`
- Test: `apps/core/src/__tests__/main.test.ts`

**Step 1: Write config loader**

```ts
// apps/core/src/config.ts
import { z } from "zod";

export const serverConfigSchema = z.object({
  port: z.number().default(3456),
  host: z.string().default("127.0.0.1"),
  jwtSecret: z.string().min(16),
  dbPath: z.string().default("./fruitctl.db"),
  adapters: z.array(z.string()).default(["reminders"]),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  return serverConfigSchema.parse({
    port: env.FRUITCTL_PORT ? Number(env.FRUITCTL_PORT) : undefined,
    host: env.FRUITCTL_HOST ?? undefined,
    jwtSecret: env.FRUITCTL_JWT_SECRET,
    dbPath: env.FRUITCTL_DB_PATH ?? undefined,
    adapters: env.FRUITCTL_ADAPTERS?.split(",") ?? undefined,
  });
}
```

**Step 2: Write failing test for config**

```ts
// apps/core/src/__tests__/config.test.ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  it("loads config from env vars", () => {
    const config = loadConfig({
      FRUITCTL_JWT_SECRET: "a-very-long-secret-key",
      FRUITCTL_PORT: "4000",
    });
    expect(config.port).toBe(4000);
    expect(config.host).toBe("127.0.0.1");
    expect(config.jwtSecret).toBe("a-very-long-secret-key");
  });

  it("throws when jwt secret is missing", () => {
    expect(() => loadConfig({})).toThrow();
  });

  it("throws when jwt secret is too short", () => {
    expect(() => loadConfig({ FRUITCTL_JWT_SECRET: "short" })).toThrow();
  });
});
```

**Step 3: Run tests**

Run: `pnpm --filter @fruitctl/core test`
Expected: FAIL then PASS after implementing config.ts.

**Step 4: Write main entry point**

```ts
// apps/core/src/main.ts
import { createDatabase } from "@fruitctl/db";
import { createServer } from "./server.js";
import { registerAdapters } from "./registry.js";
import { loadConfig } from "./config.js";
import { remindersAdapter } from "@fruitctl/reminders";
import type { AdapterPlugin } from "./adapter.js";

const ADAPTER_MAP: Record<string, AdapterPlugin> = {
  reminders: remindersAdapter,
};

async function main() {
  const config = loadConfig();
  const db = createDatabase(config.dbPath);
  const server = createServer({
    db,
    jwtSecret: config.jwtSecret,
    logger: true,
  });

  const enabledAdapters = config.adapters
    .map((name) => ADAPTER_MAP[name])
    .filter(Boolean);

  const result = await registerAdapters(server, enabledAdapters, {
    db,
    config: {},
  });

  console.log(`Registered adapters: ${result.registered.join(", ")}`);
  if (result.skipped.length > 0) {
    console.log(`Skipped adapters: ${result.skipped.join(", ")}`);
  }

  await server.listen({ port: config.port, host: config.host });
  console.log(`fruitctl server listening on ${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
```

**Step 5: Run build**

Run: `pnpm build`
Expected: All packages compile.

**Step 6: Smoke test (manual)**

Run:
```bash
FRUITCTL_JWT_SECRET="dev-secret-at-least-16" pnpm --filter @fruitctl/core dev
```
In another terminal:
```bash
curl http://127.0.0.1:3456/health
```
Expected: `{"status":"ok"}`

**Step 7: Commit**

```bash
git add apps/core/src/main.ts apps/core/src/config.ts apps/core/src/__tests__/config.test.ts
git commit -m "feat(core): add server entry point with config loading and adapter wiring"
```

---

## Task 9: CLI — Server Start, Auth, and Reminders Commands

**Files:**
- Create: `apps/cli/src/index.ts` (replace placeholder)
- Create: `apps/cli/src/commands/server.ts`
- Create: `apps/cli/src/commands/auth.ts`
- Create: `apps/cli/src/commands/reminders.ts`
- Create: `apps/cli/src/http.ts` (shared HTTP client)

**Step 1: Implement shared HTTP client**

```ts
// apps/cli/src/http.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".config", "fruitctl");
const CREDS_PATH = join(CONFIG_DIR, "credentials.json");

interface Credentials {
  token: string;
  serverUrl: string;
}

export function saveCredentials(creds: Credentials): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2));
}

export function loadCredentials(): Credentials {
  const raw = readFileSync(CREDS_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const { token, serverUrl } = loadCredentials();
  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = (data as any).error;
    throw new Error(`[${err?.code ?? res.status}] ${err?.message ?? "Request failed"}`);
  }
  return data;
}
```

**Step 2: Implement commands**

```ts
// apps/cli/src/commands/auth.ts
import { Command } from "commander";
import { randomBytes, createHmac } from "node:crypto";
import { saveCredentials } from "../http.js";

export const authCommand = new Command("auth");

authCommand
  .command("token")
  .description("Generate and save a JWT token")
  .option("--secret <secret>", "JWT secret (or set FRUITCTL_JWT_SECRET)")
  .option("--server <url>", "Server URL", "http://127.0.0.1:3456")
  .action(async (opts) => {
    const secret = opts.secret ?? process.env.FRUITCTL_JWT_SECRET;
    if (!secret) {
      console.error("Error: --secret or FRUITCTL_JWT_SECRET required");
      process.exit(1);
    }
    // Simple JWT generation (header.payload.signature)
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "fruitctl-cli", iat: Math.floor(Date.now() / 1000) }),
    ).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");
    const token = `${header}.${payload}.${signature}`;

    saveCredentials({ token, serverUrl: opts.server });
    console.log("Token saved to ~/.config/fruitctl/credentials.json");
  });
```

```ts
// apps/cli/src/commands/reminders.ts
import { Command } from "commander";
import { apiRequest } from "../http.js";

export const remindersCommand = new Command("reminders");

remindersCommand
  .command("lists")
  .description("List all reminder lists")
  .action(async () => {
    const data = (await apiRequest("GET", "/reminders/lists")) as any;
    for (const list of data.items) {
      console.log(`${list.title} (${list.id})`);
    }
  });

remindersCommand
  .command("list <name>")
  .description("List reminders in a specific list")
  .action(async (name) => {
    const data = (await apiRequest("POST", "/reminders/list", { list: name })) as any;
    for (const r of data.items) {
      const check = r.completed ? "[x]" : "[ ]";
      console.log(`${check} ${r.title} (${r.id})`);
    }
  });

remindersCommand
  .command("get <id>")
  .description("Get a specific reminder")
  .action(async (id) => {
    const data = (await apiRequest("POST", "/reminders/get", { id })) as any;
    console.log(JSON.stringify(data.item, null, 2));
  });
```

```ts
// apps/cli/src/commands/server.ts
import { Command } from "commander";
import { spawn } from "node:child_process";

export const serverCommand = new Command("server");

serverCommand
  .command("start")
  .description("Start the fruitctl server")
  .option("--port <port>", "Port", "3456")
  .option("--host <host>", "Host", "127.0.0.1")
  .action(async (opts) => {
    console.log(`Starting fruitctl server on ${opts.host}:${opts.port}...`);
    // Delegate to the core main.ts
    const child = spawn("pnpm", ["--filter", "@fruitctl/core", "dev"], {
      stdio: "inherit",
      env: {
        ...process.env,
        FRUITCTL_PORT: opts.port,
        FRUITCTL_HOST: opts.host,
      },
    });
    child.on("exit", (code) => process.exit(code ?? 0));
  });

serverCommand
  .command("status")
  .description("Check if the server is running")
  .action(async () => {
    try {
      const res = await fetch("http://127.0.0.1:3456/health");
      const data = await res.json();
      console.log(`Server status: ${(data as any).status}`);
    } catch {
      console.log("Server is not running");
    }
  });
```

**Step 3: Wire up CLI entry point**

```ts
// apps/cli/src/index.ts
#!/usr/bin/env node
import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import { remindersCommand } from "./commands/reminders.js";
import { serverCommand } from "./commands/server.js";

const program = new Command();

program
  .name("fruitctl")
  .description("Local Apple Integration Gateway CLI")
  .version("0.1.0");

program.addCommand(authCommand);
program.addCommand(serverCommand);
program.addCommand(remindersCommand);

program.parse();
```

**Step 4: Add bin field to apps/cli/package.json**

Add to `apps/cli/package.json`:
```json
{
  "bin": {
    "fruitctl": "dist/index.js"
  }
}
```

**Step 5: Build and verify**

Run: `pnpm build && pnpm --filter @fruitctl/cli exec fruitctl --help`
Expected: Shows help with `auth`, `server`, `reminders` subcommands.

**Step 6: Commit**

```bash
git add apps/cli
git commit -m "feat(cli): add fruitctl CLI with auth, server, and reminders commands"
```

---

## Task 10: Integration Test — End-to-End

**Files:**
- Create: `apps/core/src/__tests__/integration.test.ts`

**Step 1: Write integration test**

```ts
// apps/core/src/__tests__/integration.test.ts
import { describe, it, expect, vi } from "vitest";
import { createServer } from "../server.js";
import { registerAdapters } from "../registry.js";
import { createDatabase } from "@fruitctl/db";
import type { AdapterPlugin, AdapterPluginOptions } from "../adapter.js";
import type { FastifyPluginAsync } from "fastify";

// Build a mock reminders adapter inline to test full registration flow
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
  it("boots server, registers adapter, serves authenticated requests", async () => {
    const db = createDatabase(":memory:");
    const server = createServer({ db, jwtSecret: "test-secret-long-enough" });
    const adapter = createTestRemindersAdapter();

    await registerAdapters(server, [adapter], { db, config: {} });

    // Unauthenticated health check works
    const health = await server.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    // Adapter route works (no auth on adapter routes yet — auth middleware will be added per-route in Milestone 2)
    const lists = await server.inject({ method: "GET", url: "/reminders/lists" });
    expect(lists.statusCode).toBe(200);
    expect(lists.json().items).toHaveLength(1);
    expect(lists.json().items[0].title).toBe("Groceries");
  });
});
```

**Step 2: Run the integration test**

Run: `pnpm --filter @fruitctl/core test`
Expected: PASS

**Step 3: Run ALL tests across the monorepo**

Run: `pnpm test`
Expected: All tests pass across all packages.

**Step 4: Commit**

```bash
git add apps/core/src/__tests__/integration.test.ts
git commit -m "test: add end-to-end integration test for server + adapter registration"
```

---

## Summary

| Task | What | Commit Message |
|------|------|----------------|
| 1 | Monorepo scaffold | `chore: scaffold fruitctl monorepo with pnpm + Nx` |
| 2 | Database package | `feat(db): add Drizzle schema, connection factory, and initial migration` |
| 3 | Error model | `feat(core): add structured error model with error codes and HTTP status mapping` |
| 4 | Adapter contract | `feat(core): define adapter plugin contract types` |
| 5 | Server factory | `feat(core): add Fastify server factory with JWT auth and structured error handling` |
| 6 | Adapter registry | `feat(core): add adapter registration system with dep checking and capability aggregation` |
| 7 | Reminders adapter | `feat(reminders): add read-only reminders adapter with remindctl wrapper` |
| 8 | Server entry point | `feat(core): add server entry point with config loading and adapter wiring` |
| 9 | CLI | `feat(cli): add fruitctl CLI with auth, server, and reminders commands` |
| 10 | Integration test | `test: add end-to-end integration test for server + adapter registration` |
