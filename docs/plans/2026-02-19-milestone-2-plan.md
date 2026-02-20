# Milestone 2: Approval Engine + Reminders Write — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an approval engine so mutating operations require human sign-off, then implement reminders write operations (add, edit, complete, delete) gated behind that engine.

**Architecture:** A proposal-based state machine lives in `@fruitctl/core`. Write requests create a PENDING proposal, which must be approved before execution. Approved proposals call back into the originating adapter's `execute` function. Results are logged to an audit trail. The adapter contract in `@fruitctl/shared` gains an `actions` map so adapters can declare validate/execute pairs per write action.

**Tech Stack:** Drizzle ORM 0.45 (SQLite), Fastify 5.7, Zod 4, Commander 14, remindctl CLI

---

## Task 1: Proposals & Audit Log DB Schema

Add `proposals` and `audit_log` tables to `@fruitctl/db`.

**Files:**

- Modify: `packages/db/src/schema.ts`
- Test: `packages/db/src/__tests__/schema.test.ts`

**Step 1: Write the failing test**

```ts
// packages/db/src/__tests__/schema.test.ts
// ADD these tests to the existing file

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../connection.js";
import { auditLog, proposals } from "../schema.js";

describe("proposals table", () => {
 it("inserts and retrieves a proposal", async () => {
  const db = createDatabase(":memory:");
  const id = crypto.randomUUID();
  await db.insert(proposals).values({
   id,
   adapter: "reminders",
   action: "add",
   params: JSON.stringify({ title: "Milk", list: "Shopping" }),
   status: "pending",
  });
  const rows = await db
   .select()
   .from(proposals)
   .where(eq(proposals.id, id));
  expect(rows).toHaveLength(1);
  expect(rows[0].adapter).toBe("reminders");
  expect(rows[0].status).toBe("pending");
 });
});

describe("audit_log table", () => {
 it("inserts and retrieves an audit entry", async () => {
  const db = createDatabase(":memory:");
  const proposalId = crypto.randomUUID();
  await db.insert(proposals).values({
   id: proposalId,
   adapter: "reminders",
   action: "add",
   params: "{}",
   status: "approved",
  });
  await db.insert(auditLog).values({
   id: crypto.randomUUID(),
   proposalId,
   adapter: "reminders",
   action: "add",
   params: "{}",
   result: JSON.stringify({ id: "r-1" }),
  });
  const rows = await db
   .select()
   .from(auditLog)
   .where(eq(auditLog.proposalId, proposalId));
  expect(rows).toHaveLength(1);
  expect(rows[0].result).toContain("r-1");
 });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm nx run @fruitctl/db:test`
Expected: FAIL — `proposals` and `auditLog` not exported from schema

**Step 3: Write minimal implementation**

```ts
// packages/db/src/schema.ts — ADD after the existing `config` table

export const proposals = sqliteTable("proposals", {
 id: text("id").primaryKey(),
 adapter: text("adapter").notNull(),
 action: text("action").notNull(),
 params: text("params").notNull(), // JSON string
 status: text("status", {
  enum: ["pending", "approved", "rejected", "expired", "executed"],
 }).notNull(),
 createdAt: integer("created_at", { mode: "timestamp" })
  .$defaultFn(() => new Date()),
 resolvedAt: integer("resolved_at", { mode: "timestamp" }),
 resolvedBy: text("resolved_by"),
});

export const auditLog = sqliteTable("audit_log", {
 id: text("id").primaryKey(),
 proposalId: text("proposal_id")
  .notNull()
  .references(() => proposals.id),
 adapter: text("adapter").notNull(),
 action: text("action").notNull(),
 params: text("params").notNull(),
 result: text("result"),
 error: text("error"),
 timestamp: integer("timestamp", { mode: "timestamp" })
  .$defaultFn(() => new Date()),
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm nx run @fruitctl/db:test`
Expected: PASS (all tests including existing `connection.test.ts`)

**Step 5: Generate migration**

Run: `cd packages/db && pnpm drizzle-kit generate`
Expected: New migration file in `packages/db/drizzle/`

**Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/__tests__/schema.test.ts packages/db/drizzle/
git commit -m "feat(db): add proposals and audit_log tables"
```

---

## Task 2: Adapter Action Contract

Extend the adapter contract so plugins can declare write actions with validate/execute pairs.

**Files:**

- Modify: `packages/shared/src/adapter.ts`
- Test: `packages/shared/src/__tests__/adapter.test.ts`

**Step 1: Write the failing test**

```ts
// packages/shared/src/__tests__/adapter.test.ts (NEW FILE)
import { describe, expect, it } from "vitest";
import type { ActionDef, AdapterManifest } from "../adapter.js";

describe("ActionDef type", () => {
 it("defines a write action with validate and execute", () => {
  const action: ActionDef = {
   name: "add",
   description: "Add a reminder",
   paramsSchema: {} as any,
   validate: async (params) => params,
   execute: async (params) => ({ id: "r-1" }),
  };
  expect(action.name).toBe("add");
  expect(typeof action.validate).toBe("function");
  expect(typeof action.execute).toBe("function");
 });

 it("manifest can include actions map", () => {
  const manifest: AdapterManifest = {
   name: "test",
   version: "0.1.0",
   nativeDeps: [],
   capabilities: [],
   actions: {
    add: {
     name: "add",
     description: "Add a thing",
     paramsSchema: {} as any,
     validate: async (params) => params,
     execute: async (params) => ({ ok: true }),
    },
   },
  };
  expect(manifest.actions?.add.name).toBe("add");
 });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm nx run @fruitctl/shared:test`
Expected: FAIL — `ActionDef` not exported, `actions` not on `AdapterManifest`

**Step 3: Write minimal implementation**

Add to `packages/shared/src/adapter.ts`, after the existing `CapabilityDef`:

```ts
export interface ActionDef {
 name: string;
 description: string;
 paramsSchema: ZodType;
 validate: (params: unknown) => Promise<unknown>;
 execute: (params: unknown) => Promise<unknown>;
}
```

And add to `AdapterManifest`:

```ts
export interface AdapterManifest {
 name: string;
 version: string;
 nativeDeps: NativeDep[];
 capabilities: CapabilityDef[];
 actions?: Record<string, ActionDef>; // NEW — write actions
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm nx run @fruitctl/shared:test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/adapter.ts packages/shared/src/__tests__/adapter.test.ts
git commit -m "feat(shared): add ActionDef type and actions to AdapterManifest"
```

---

## Task 3: Approval Engine Core

Create the proposal state machine that stores, resolves, expires, and executes proposals.

**Files:**

- Create: `apps/core/src/approval.ts`
- Test: `apps/core/src/__tests__/approval.test.ts`

**Step 1: Write the failing test**

```ts
// apps/core/src/__tests__/approval.test.ts (NEW FILE)
import { createDatabase } from "@fruitctl/db";
import { proposals } from "@fruitctl/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { ApprovalEngine } from "../approval.js";

function makeEngine() {
 const db = createDatabase(":memory:");
 return { db, engine: new ApprovalEngine(db) };
}

describe("ApprovalEngine", () => {
 it("creates a pending proposal", async () => {
  const { engine } = makeEngine();
  const proposal = await engine.propose({
   adapter: "reminders",
   action: "add",
   params: { title: "Milk", list: "Shopping" },
  });
  expect(proposal.id).toBeDefined();
  expect(proposal.status).toBe("pending");
 });

 it("approves a pending proposal", async () => {
  const { engine } = makeEngine();
  const { id } = await engine.propose({
   adapter: "reminders",
   action: "add",
   params: { title: "Milk" },
  });
  const result = await engine.approve(id, "cli-user");
  expect(result.status).toBe("approved");
  expect(result.resolvedBy).toBe("cli-user");
 });

 it("rejects a pending proposal", async () => {
  const { engine } = makeEngine();
  const { id } = await engine.propose({
   adapter: "reminders",
   action: "add",
   params: { title: "Milk" },
  });
  const result = await engine.reject(id, "cli-user");
  expect(result.status).toBe("rejected");
 });

 it("throws when approving non-existent proposal", async () => {
  const { engine } = makeEngine();
  await expect(engine.approve("nope", "user")).rejects.toThrow(
   "PROPOSAL_NOT_FOUND",
  );
 });

 it("throws when approving already-resolved proposal", async () => {
  const { engine } = makeEngine();
  const { id } = await engine.propose({
   adapter: "reminders",
   action: "add",
   params: {},
  });
  await engine.reject(id, "user");
  await expect(engine.approve(id, "user")).rejects.toThrow();
 });

 it("lists proposals filtered by status", async () => {
  const { engine } = makeEngine();
  await engine.propose({ adapter: "r", action: "add", params: {} });
  await engine.propose({ adapter: "r", action: "edit", params: {} });
  const { id } = await engine.propose({
   adapter: "r",
   action: "delete",
   params: {},
  });
  await engine.reject(id, "user");

  const pending = await engine.list({ status: "pending" });
  expect(pending).toHaveLength(2);

  const all = await engine.list();
  expect(all).toHaveLength(3);
 });

 it("gets a single proposal by id", async () => {
  const { engine } = makeEngine();
  const { id } = await engine.propose({
   adapter: "reminders",
   action: "add",
   params: { title: "Test" },
  });
  const proposal = await engine.get(id);
  expect(proposal.adapter).toBe("reminders");
  expect(proposal.params).toEqual({ title: "Test" });
 });

 it("expires proposals older than TTL", async () => {
  const { db, engine } = makeEngine();
  const { id } = await engine.propose({
   adapter: "r",
   action: "add",
   params: {},
  });

  // Manually backdate the proposal
  await db
   .update(proposals)
   .set({
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
   })
   .where(eq(proposals.id, id));

  const expired = await engine.expireStale(60 * 60 * 1000); // 1 hour TTL
  expect(expired).toBe(1);

  const proposal = await engine.get(id);
  expect(proposal.status).toBe("expired");
 });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm nx run @fruitctl/core:test`
Expected: FAIL — `ApprovalEngine` doesn't exist

**Important:** The test imports `@fruitctl/db/schema` directly. You may need to add a `"@fruitctl/db/schema"` path in `tsconfig.base.json`:

```json
"@fruitctl/db/schema": ["./packages/db/src/schema"]
```

And add a `"./schema"` export in `packages/db/package.json`:

```json
"exports": {
  ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
  "./schema": { "import": "./dist/schema.js", "types": "./dist/schema.d.ts" }
}
```

Alternatively, re-export `proposals` and `auditLog` from `packages/db/src/index.ts` so the test can just import from `@fruitctl/db`.

**Step 3: Write minimal implementation**

```ts
// apps/core/src/approval.ts
import type { AppDatabase } from "@fruitctl/db";
import { auditLog, proposals } from "@fruitctl/db";
import { AppError, ErrorCode } from "@fruitctl/shared";
import { and, eq, lt } from "drizzle-orm";

export interface ProposeInput {
 adapter: string;
 action: string;
 params: unknown;
}

export interface Proposal {
 id: string;
 adapter: string;
 action: string;
 params: unknown;
 status: string;
 createdAt: Date | null;
 resolvedAt: Date | null;
 resolvedBy: string | null;
}

export interface ListOptions {
 status?: string;
}

export class ApprovalEngine {
 constructor(private db: AppDatabase) {}

 async propose(input: ProposeInput): Promise<Proposal> {
  const id = crypto.randomUUID();
  const now = new Date();
  await this.db.insert(proposals).values({
   id,
   adapter: input.adapter,
   action: input.action,
   params: JSON.stringify(input.params),
   status: "pending",
   createdAt: now,
  });
  return {
   id,
   adapter: input.adapter,
   action: input.action,
   params: input.params,
   status: "pending",
   createdAt: now,
   resolvedAt: null,
   resolvedBy: null,
  };
 }

 async get(id: string): Promise<Proposal> {
  const rows = await this.db
   .select()
   .from(proposals)
   .where(eq(proposals.id, id));
  if (rows.length === 0) {
   throw new AppError(ErrorCode.PROPOSAL_NOT_FOUND, `Proposal "${id}" not found`);
  }
  return this.toProposal(rows[0]);
 }

 async approve(id: string, resolvedBy: string): Promise<Proposal> {
  return this.resolve(id, "approved", resolvedBy);
 }

 async reject(id: string, resolvedBy: string): Promise<Proposal> {
  return this.resolve(id, "rejected", resolvedBy);
 }

 async list(options?: ListOptions): Promise<Proposal[]> {
  const conditions = options?.status
   ? eq(proposals.status, options.status)
   : undefined;
  const rows = await this.db
   .select()
   .from(proposals)
   .where(conditions)
   .orderBy(proposals.createdAt);
  return rows.map((r) => this.toProposal(r));
 }

 async expireStale(ttlMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - ttlMs);
  const result = await this.db
   .update(proposals)
   .set({ status: "expired", resolvedAt: new Date() })
   .where(
    and(eq(proposals.status, "pending"), lt(proposals.createdAt, cutoff)),
   );
  return result.changes;
 }

 async logExecution(
  proposal: Proposal,
  result?: unknown,
  error?: string,
 ): Promise<void> {
  await this.db.insert(auditLog).values({
   id: crypto.randomUUID(),
   proposalId: proposal.id,
   adapter: proposal.adapter,
   action: proposal.action,
   params: JSON.stringify(proposal.params),
   result: result ? JSON.stringify(result) : null,
   error: error ?? null,
  });
 }

 private async resolve(
  id: string,
  status: string,
  resolvedBy: string,
 ): Promise<Proposal> {
  const proposal = await this.get(id);
  if (proposal.status !== "pending") {
   throw new AppError(
    ErrorCode.VALIDATION_ERROR,
    `Proposal "${id}" is already ${proposal.status}`,
   );
  }
  const now = new Date();
  await this.db
   .update(proposals)
   .set({ status, resolvedAt: now, resolvedBy })
   .where(eq(proposals.id, id));
  return { ...proposal, status, resolvedAt: now, resolvedBy };
 }

 private toProposal(row: typeof proposals.$inferSelect): Proposal {
  return {
   id: row.id,
   adapter: row.adapter,
   action: row.action,
   params: JSON.parse(row.params),
   status: row.status,
   createdAt: row.createdAt,
   resolvedAt: row.resolvedAt ?? null,
   resolvedBy: row.resolvedBy ?? null,
  };
 }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm nx run @fruitctl/core:test`
Expected: PASS

**Step 5: Export and commit**

Add to `apps/core/src/index.ts`:

```ts
export * from "./approval.js";
```

```bash
git add apps/core/src/approval.ts apps/core/src/__tests__/approval.test.ts apps/core/src/index.ts
git commit -m "feat(core): add approval engine with propose/approve/reject/expire"
```

---

## Task 4: Proposal API Routes

Add HTTP endpoints for listing, approving, and rejecting proposals. Also wire the approval engine into the server startup and adapter registration.

**Files:**

- Create: `apps/core/src/proposals-routes.ts`
- Modify: `apps/core/src/server.ts` (add approval engine to options)
- Modify: `apps/core/src/registry.ts` (pass approval engine to adapters)
- Modify: `packages/shared/src/adapter.ts` (add approval engine to plugin options)
- Test: `apps/core/src/__tests__/proposals-routes.test.ts`

**Step 1: Extend AdapterPluginOptions**

In `packages/shared/src/adapter.ts`, add the approval engine type to the plugin options. Since the engine lives in `@fruitctl/core`, use an interface to avoid circular deps:

```ts
// ADD to packages/shared/src/adapter.ts

export interface ApprovalEngineInterface {
 propose(input: {
  adapter: string;
  action: string;
  params: unknown;
 }): Promise<{ id: string; status: string }>;
}

export interface AdapterPluginOptions {
 db: AppDatabase;
 config: Record<string, unknown>;
 approval: ApprovalEngineInterface; // NEW
}
```

**Step 2: Write the failing test for routes**

```ts
// apps/core/src/__tests__/proposals-routes.test.ts (NEW FILE)
import { createDatabase } from "@fruitctl/db";
import { describe, expect, it } from "vitest";
import { ApprovalEngine } from "../approval.js";
import { createServer } from "../server.js";
import { registerProposalRoutes } from "../proposals-routes.js";

function buildApp() {
 const db = createDatabase(":memory:");
 const engine = new ApprovalEngine(db);
 const server = createServer({ db, jwtSecret: "test-secret-long-enough" });
 registerProposalRoutes(server, engine);
 return { server, engine };
}

describe("proposal routes", () => {
 it("POST /proposals returns 201 with proposal", async () => {
  const { server, engine } = buildApp();
  // Seed a proposal directly
  const proposal = await engine.propose({
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

 it("GET /proposals?status=pending filters", async () => {
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
```

**Step 3: Run test to verify it fails**

Run: `pnpm nx run @fruitctl/core:test`
Expected: FAIL — `registerProposalRoutes` doesn't exist

**Step 4: Write minimal implementation**

```ts
// apps/core/src/proposals-routes.ts (NEW FILE)
import type { FastifyInstance } from "fastify";
import type { ApprovalEngine } from "./approval.js";

export function registerProposalRoutes(
 server: FastifyInstance,
 engine: ApprovalEngine,
) {
 server.get("/proposals", async (request) => {
  const { status } = request.query as { status?: string };
  const items = await engine.list(status ? { status } : undefined);
  return { items };
 });

 server.get("/proposals/:id", async (request) => {
  const { id } = request.params as { id: string };
  return engine.get(id);
 });

 server.post("/proposals/:id/approve", async (request) => {
  const { id } = request.params as { id: string };
  return engine.approve(id, "cli");
 });

 server.post("/proposals/:id/reject", async (request) => {
  const { id } = request.params as { id: string };
  return engine.reject(id, "cli");
 });
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm nx run @fruitctl/core:test`
Expected: PASS

**Step 6: Wire into server startup**

Modify `apps/core/src/main.ts` — import `ApprovalEngine` and `registerProposalRoutes`, create the engine after the db, register proposal routes, and pass `approval` into `registerAdapters` options:

```ts
// In main():
const engine = new ApprovalEngine(db);
registerProposalRoutes(server, engine);

const result = await registerAdapters(server, enabledAdapters, {
 db,
 config: {},
 approval: engine,
});
```

Update `apps/core/src/registry.ts` — the `RegistrationOptions` interface should include `approval`:

```ts
interface RegistrationOptions {
 db: AppDatabase;
 config: Record<string, unknown>;
 approval: ApprovalEngineInterface;
}
```

And pass it through in `server.register(adapter, { ..., approval: options.approval })`.

**Step 7: Commit**

```bash
git add apps/core/src/proposals-routes.ts apps/core/src/__tests__/proposals-routes.test.ts apps/core/src/main.ts apps/core/src/registry.ts packages/shared/src/adapter.ts
git commit -m "feat(core): add proposal HTTP routes and wire approval engine"
```

---

## Task 5: Proposal Execution Flow

When a proposal is approved, find the adapter's execute function and run it. Log the result to the audit trail.

**Files:**

- Modify: `apps/core/src/approval.ts`
- Modify: `apps/core/src/proposals-routes.ts`
- Test: `apps/core/src/__tests__/execution.test.ts`

**Step 1: Write the failing test**

```ts
// apps/core/src/__tests__/execution.test.ts (NEW FILE)
import { createDatabase } from "@fruitctl/db";
import { auditLog } from "@fruitctl/db";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { ApprovalEngine } from "../approval.js";
import type { ActionRegistry } from "../approval.js";

describe("proposal execution", () => {
 it("executes the action on approval when registry is set", async () => {
  const db = createDatabase(":memory:");
  const executeFn = vi.fn().mockResolvedValue({ id: "new-reminder" });
  const registry: ActionRegistry = {
   getAction: (_adapter, _action) => ({
    execute: executeFn,
   }),
  };
  const engine = new ApprovalEngine(db, { registry });

  const { id } = await engine.propose({
   adapter: "reminders",
   action: "add",
   params: { title: "Milk" },
  });
  await engine.approve(id, "cli");

  expect(executeFn).toHaveBeenCalledWith({ title: "Milk" });

  // Check audit log
  const logs = await db
   .select()
   .from(auditLog)
   .where(eq(auditLog.proposalId, id));
  expect(logs).toHaveLength(1);
  expect(logs[0].result).toContain("new-reminder");
 });

 it("logs errors when execution fails", async () => {
  const db = createDatabase(":memory:");
  const registry: ActionRegistry = {
   getAction: () => ({
    execute: async () => {
     throw new Error("remindctl failed");
    },
   }),
  };
  const engine = new ApprovalEngine(db, { registry });

  const { id } = await engine.propose({
   adapter: "reminders",
   action: "add",
   params: {},
  });
  const result = await engine.approve(id, "cli");

  expect(result.status).toBe("approved");

  const logs = await db
   .select()
   .from(auditLog)
   .where(eq(auditLog.proposalId, id));
  expect(logs).toHaveLength(1);
  expect(logs[0].error).toContain("remindctl failed");
 });

 it("skips execution when no registry is configured", async () => {
  const db = createDatabase(":memory:");
  const engine = new ApprovalEngine(db);
  const { id } = await engine.propose({
   adapter: "r",
   action: "add",
   params: {},
  });
  // Should not throw
  const result = await engine.approve(id, "cli");
  expect(result.status).toBe("approved");
 });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm nx run @fruitctl/core:test`
Expected: FAIL — `ActionRegistry` not exported

**Step 3: Write minimal implementation**

Modify `apps/core/src/approval.ts`:

Add an `ActionRegistry` interface and optional `registry` option to the constructor. After resolving to "approved", if a registry exists, look up the action and call `execute`. Log the result or error.

```ts
// ADD to approval.ts

export interface ActionRegistry {
 getAction(
  adapter: string,
  action: string,
 ): { execute: (params: unknown) => Promise<unknown> } | undefined;
}

interface ApprovalEngineOptions {
 registry?: ActionRegistry;
}

// Modify constructor:
export class ApprovalEngine {
 private registry?: ActionRegistry;

 constructor(private db: AppDatabase, options?: ApprovalEngineOptions) {
  this.registry = options?.registry;
 }

 // Modify approve() — after resolve, try execute:
 async approve(id: string, resolvedBy: string): Promise<Proposal> {
  const resolved = await this.resolve(id, "approved", resolvedBy);

  const actionDef = this.registry?.getAction(
   resolved.adapter,
   resolved.action,
  );
  if (actionDef) {
   try {
    const result = await actionDef.execute(resolved.params);
    await this.logExecution(resolved, result);
   } catch (err) {
    await this.logExecution(
     resolved,
     undefined,
     err instanceof Error ? err.message : String(err),
    );
   }
  }

  return resolved;
 }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm nx run @fruitctl/core:test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/core/src/approval.ts apps/core/src/__tests__/execution.test.ts
git commit -m "feat(core): execute adapter actions on proposal approval with audit logging"
```

---

## Task 6: Reminders Write Operations

Add write commands to `remindctl.ts` wrapper, Zod schemas, and plugin routes that create proposals.

**Files:**

- Modify: `packages/plugins/reminders/src/remindctl.ts`
- Modify: `packages/plugins/reminders/src/schemas.ts`
- Modify: `packages/plugins/reminders/src/plugin.ts`
- Modify: `packages/plugins/reminders/src/index.ts`
- Test: `packages/plugins/reminders/src/__tests__/remindctl.test.ts`
- Test: `packages/plugins/reminders/src/__tests__/plugin.test.ts`

**Step 1: Write failing tests for Remindctl write methods**

Add to `packages/plugins/reminders/src/__tests__/remindctl.test.ts`:

```ts
// ADD to existing describe block

it("adds a reminder", async () => {
 const exec = vi.fn().mockResolvedValue({
  stdout: JSON.stringify({ id: "new-1", title: "Milk" }),
 });
 const ctl = new Remindctl(exec);
 const result = await ctl.add({ title: "Milk", list: "Shopping" });
 expect(exec).toHaveBeenCalledWith(
  'remindctl add --title "Milk" --list "Shopping" --json --no-input',
 );
 expect(result.title).toBe("Milk");
});

it("completes a reminder", async () => {
 const exec = vi.fn().mockResolvedValue({ stdout: "{}" });
 const ctl = new Remindctl(exec);
 await ctl.complete("r-1");
 expect(exec).toHaveBeenCalledWith(
  "remindctl complete r-1 --json --no-input",
 );
});

it("deletes a reminder", async () => {
 const exec = vi.fn().mockResolvedValue({ stdout: "{}" });
 const ctl = new Remindctl(exec);
 await ctl.delete("r-1");
 expect(exec).toHaveBeenCalledWith(
  "remindctl delete r-1 --force --json --no-input",
 );
});

it("edits a reminder", async () => {
 const exec = vi.fn().mockResolvedValue({
  stdout: JSON.stringify({ id: "r-1", title: "Updated" }),
 });
 const ctl = new Remindctl(exec);
 const result = await ctl.edit("r-1", { title: "Updated" });
 expect(exec).toHaveBeenCalledWith(
  'remindctl edit r-1 --title "Updated" --json --no-input',
 );
 expect(result.title).toBe("Updated");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm nx run @fruitctl/reminders:test`
Expected: FAIL — `add`, `complete`, `delete`, `edit` not on Remindctl

**Step 3: Write minimal implementation for Remindctl**

Add to `packages/plugins/reminders/src/remindctl.ts`:

```ts
interface AddOptions {
 title: string;
 list?: string;
 due?: string;
 notes?: string;
 priority?: "none" | "low" | "medium" | "high";
}

interface EditOptions {
 title?: string;
 list?: string;
 due?: string;
 notes?: string;
 priority?: "none" | "low" | "medium" | "high";
}

// Inside Remindctl class:

async add(opts: AddOptions): Promise<unknown> {
 const parts = ["remindctl add"];
 parts.push(`--title "${opts.title}"`);
 if (opts.list) parts.push(`--list "${opts.list}"`);
 if (opts.due) parts.push(`--due "${opts.due}"`);
 if (opts.notes) parts.push(`--notes "${opts.notes}"`);
 if (opts.priority) parts.push(`--priority ${opts.priority}`);
 parts.push("--json --no-input");
 const { stdout } = await this.exec(parts.join(" "));
 return JSON.parse(stdout);
}

async complete(id: string): Promise<void> {
 await this.exec(`remindctl complete ${id} --json --no-input`);
}

async delete(id: string): Promise<void> {
 await this.exec(`remindctl delete ${id} --force --json --no-input`);
}

async edit(id: string, opts: EditOptions): Promise<unknown> {
 const parts = [`remindctl edit ${id}`];
 if (opts.title) parts.push(`--title "${opts.title}"`);
 if (opts.list) parts.push(`--list "${opts.list}"`);
 if (opts.due) parts.push(`--due "${opts.due}"`);
 if (opts.notes) parts.push(`--notes "${opts.notes}"`);
 if (opts.priority) parts.push(`--priority ${opts.priority}`);
 parts.push("--json --no-input");
 const { stdout } = await this.exec(parts.join(" "));
 return JSON.parse(stdout);
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm nx run @fruitctl/reminders:test`
Expected: PASS

**Step 5: Add Zod schemas for write operations**

Add to `packages/plugins/reminders/src/schemas.ts`:

```ts
export const addReminderSchema = z.object({
 title: z.string().min(1).max(500),
 list: z.string().min(1).max(200).optional(),
 due: z.string().max(100).optional(),
 notes: z.string().max(2000).optional(),
 priority: z.enum(["none", "low", "medium", "high"]).optional(),
});

export const editReminderSchema = z.object({
 id: z.string().min(1),
 title: z.string().min(1).max(500).optional(),
 list: z.string().min(1).max(200).optional(),
 due: z.string().max(100).optional(),
 notes: z.string().max(2000).optional(),
 priority: z.enum(["none", "low", "medium", "high"]).optional(),
});

export const completeReminderSchema = z.object({
 id: z.string().min(1),
});

export const deleteReminderSchema = z.object({
 id: z.string().min(1),
});
```

**Step 6: Add write routes to plugin**

Add to `packages/plugins/reminders/src/plugin.ts` — these routes create proposals instead of executing directly:

```ts
// Inside remindersPlugin, after existing read routes:

fastify.post("/add", async (request) => {
 const parsed = addReminderSchema.safeParse(request.body);
 if (!parsed.success) {
  throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
 }
 return opts.approval.propose({
  adapter: "reminders",
  action: "add",
  params: parsed.data,
 });
});

fastify.post("/edit", async (request) => {
 const parsed = editReminderSchema.safeParse(request.body);
 if (!parsed.success) {
  throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
 }
 return opts.approval.propose({
  adapter: "reminders",
  action: "edit",
  params: parsed.data,
 });
});

fastify.post("/complete", async (request) => {
 const parsed = completeReminderSchema.safeParse(request.body);
 if (!parsed.success) {
  throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
 }
 return opts.approval.propose({
  adapter: "reminders",
  action: "complete",
  params: parsed.data,
 });
});

fastify.post("/delete", async (request) => {
 const parsed = deleteReminderSchema.safeParse(request.body);
 if (!parsed.success) {
  throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
 }
 return opts.approval.propose({
  adapter: "reminders",
  action: "delete",
  params: parsed.data,
 });
});
```

**Step 7: Register actions in adapter manifest**

Update `packages/plugins/reminders/src/index.ts` to include `actions` on the manifest:

```ts
const ctl = new Remindctl();

export const remindersAdapter: AdapterPlugin = Object.assign(remindersPlugin, {
 manifest: {
  name: "reminders",
  version: "0.2.0",
  nativeDeps: [{ name: "remindctl", check: () => ctl.isAvailable() }],
  capabilities: [
   /* existing read capabilities */
  ],
  actions: {
   add: {
    name: "add",
    description: "Add a new reminder",
    paramsSchema: addReminderSchema,
    validate: async (params) =>
     addReminderSchema.parse(params),
    execute: async (params) => {
     const p = params as z.infer<typeof addReminderSchema>;
     return ctl.add(p);
    },
   },
   edit: {
    name: "edit",
    description: "Edit an existing reminder",
    paramsSchema: editReminderSchema,
    validate: async (params) =>
     editReminderSchema.parse(params),
    execute: async (params) => {
     const p = params as z.infer<typeof editReminderSchema>;
     return ctl.edit(p.id, p);
    },
   },
   complete: {
    name: "complete",
    description: "Mark a reminder as complete",
    paramsSchema: completeReminderSchema,
    validate: async (params) =>
     completeReminderSchema.parse(params),
    execute: async (params) => {
     const p = params as z.infer<typeof completeReminderSchema>;
     return ctl.complete(p.id);
    },
   },
   delete: {
    name: "delete",
    description: "Delete a reminder",
    paramsSchema: deleteReminderSchema,
    validate: async (params) =>
     deleteReminderSchema.parse(params),
    execute: async (params) => {
     const p = params as z.infer<typeof deleteReminderSchema>;
     return ctl.delete(p.id);
    },
   },
  },
 },
});
```

**Step 8: Update plugin tests**

Add write route tests to `packages/plugins/reminders/src/__tests__/plugin.test.ts`:

```ts
// The test's buildServer() needs to inject a mock approval engine.
// Add a mock:
const mockApproval = {
 propose: vi.fn().mockResolvedValue({ id: "prop-1", status: "pending" }),
};

// Modify buildServer to pass it:
server.register(remindersPlugin, {
 db,
 config: {},
 approval: mockApproval,
 _mockExec: vi.fn(/* ... existing mock ... */),
});

// ADD new tests:

it("POST /add creates a proposal", async () => {
 const server = buildServer();
 const res = await server.inject({
  method: "POST",
  url: "/add",
  payload: { title: "Milk", list: "Shopping" },
 });
 expect(res.statusCode).toBe(200);
 expect(res.json().status).toBe("pending");
 expect(mockApproval.propose).toHaveBeenCalledWith({
  adapter: "reminders",
  action: "add",
  params: { title: "Milk", list: "Shopping" },
 });
});

it("POST /add rejects invalid payload", async () => {
 const server = buildServer();
 const res = await server.inject({
  method: "POST",
  url: "/add",
  payload: { title: "" },
 });
 expect(res.statusCode).toBe(400);
});

it("POST /complete creates a proposal", async () => {
 const server = buildServer();
 const res = await server.inject({
  method: "POST",
  url: "/complete",
  payload: { id: "r-1" },
 });
 expect(res.statusCode).toBe(200);
 expect(res.json().status).toBe("pending");
});
```

**Step 9: Run all tests**

Run: `pnpm nx run-many -t test`
Expected: PASS

**Step 10: Commit**

```bash
git add packages/plugins/reminders/
git commit -m "feat(reminders): add write operations (add, edit, complete, delete) with approval flow"
```

---

## Task 7: Wire Action Registry into Server Startup

Connect the adapter manifests' `actions` to the approval engine so approved proposals actually execute.

**Files:**

- Modify: `apps/core/src/registry.ts`
- Modify: `apps/core/src/main.ts`
- Test: `apps/core/src/__tests__/integration.test.ts`

**Step 1: Write the failing test**

Add to `apps/core/src/__tests__/integration.test.ts`:

```ts
it("executes adapter action when proposal is approved", async () => {
 const db = createDatabase(":memory:");
 const engine = new ApprovalEngine(db);
 const executeFn = vi.fn().mockResolvedValue({ id: "new-1" });

 const mockAdapter: AdapterPlugin = Object.assign(
  (async (fastify, opts) => {
   fastify.post("/add", async (request) => {
    const body = request.body as any;
    return opts.approval.propose({
     adapter: "mock",
     action: "add",
     params: body,
    });
   });
  }) as FastifyPluginAsync<AdapterPluginOptions>,
  {
   manifest: {
    name: "mock",
    version: "0.1.0",
    nativeDeps: [],
    capabilities: [],
    actions: {
     add: {
      name: "add",
      description: "Add a thing",
      paramsSchema: {} as any,
      validate: async (p: unknown) => p,
      execute: executeFn,
     },
    },
   },
  },
 );

 const server = createServer({
  db,
  jwtSecret: "test-secret-long-enough",
 });

 const result = await registerAdapters(server, [mockAdapter], {
  db,
  config: {},
  approval: engine,
 });

 // The registry should now be wired to the engine
 // Create a proposal via the route
 await server.ready();
 const res = await server.inject({
  method: "POST",
  url: "/mock/add",
  payload: { title: "Test" },
 });
 const proposalId = res.json().id;

 // Approve it
 await engine.approve(proposalId, "test-user");

 expect(executeFn).toHaveBeenCalledWith({ title: "Test" });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm nx run @fruitctl/core:test`
Expected: FAIL — registry doesn't build action registry from manifests

**Step 3: Write minimal implementation**

Modify `apps/core/src/registry.ts` — after registering all adapters, build an `ActionRegistry` from their manifests and set it on the engine:

```ts
import type { ActionRegistry } from "./approval.js";
import type { ApprovalEngineInterface } from "@fruitctl/shared";

interface RegistrationOptions {
 db: AppDatabase;
 config: Record<string, unknown>;
 approval: ApprovalEngineInterface & {
  setRegistry?: (registry: ActionRegistry) => void;
 };
}

// At end of registerAdapters(), after the loop:
const actionMap = new Map<string, Map<string, { execute: (params: unknown) => Promise<unknown> }>>();

for (const adapter of adapters) {
 const { manifest } = adapter;
 if (manifest.actions) {
  const adapterActions = new Map<string, { execute: (params: unknown) => Promise<unknown> }>();
  for (const [name, def] of Object.entries(manifest.actions)) {
   adapterActions.set(name, { execute: def.execute });
  }
  actionMap.set(manifest.name, adapterActions);
 }
}

const registry: ActionRegistry = {
 getAction(adapter, action) {
  return actionMap.get(adapter)?.get(action);
 },
};

if ("setRegistry" in options.approval && typeof options.approval.setRegistry === "function") {
 options.approval.setRegistry(registry);
}
```

Add `setRegistry` method to `ApprovalEngine`:

```ts
setRegistry(registry: ActionRegistry): void {
 this.registry = registry;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm nx run @fruitctl/core:test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/core/src/registry.ts apps/core/src/approval.ts apps/core/src/__tests__/integration.test.ts
git commit -m "feat(core): wire action registry from adapter manifests into approval engine"
```

---

## Task 8: Proposals CLI Commands

Add `fruitctl proposals list/approve/reject` and `fruitctl config set/get` CLI commands.

**Files:**

- Create: `apps/cli/src/commands/proposals.ts`
- Create: `apps/cli/src/commands/config.ts`
- Modify: `apps/cli/src/index.ts`

**Step 1: Write implementation**

```ts
// apps/cli/src/commands/proposals.ts (NEW FILE)
import { Command } from "commander";
import { apiRequest } from "../http.js";

export const proposalsCommand = new Command("proposals");

proposalsCommand
 .command("list")
 .description("List proposals")
 .option("--status <status>", "Filter by status (pending, approved, rejected, expired)")
 .action(async (opts) => {
  const query = opts.status ? `?status=${opts.status}` : "";
  const data = (await apiRequest("GET", `/proposals${query}`)) as any;
  if (data.items.length === 0) {
   console.log("No proposals found.");
   return;
  }
  for (const p of data.items) {
   const date = new Date(p.createdAt).toLocaleString();
   console.log(
    `[${p.status.toUpperCase()}] ${p.id.slice(0, 8)} — ${p.adapter}:${p.action} (${date})`,
   );
   console.log(`  params: ${JSON.stringify(p.params)}`);
  }
 });

proposalsCommand
 .command("approve <id>")
 .description("Approve a pending proposal")
 .action(async (id) => {
  const data = (await apiRequest("POST", `/proposals/${id}/approve`)) as any;
  console.log(`Proposal ${id.slice(0, 8)} approved.`);
  if (data.adapter) {
   console.log(`Action: ${data.adapter}:${data.action}`);
  }
 });

proposalsCommand
 .command("reject <id>")
 .description("Reject a pending proposal")
 .action(async (id) => {
  const data = (await apiRequest("POST", `/proposals/${id}/reject`)) as any;
  console.log(`Proposal ${id.slice(0, 8)} rejected.`);
 });

proposalsCommand
 .command("show <id>")
 .description("Show details of a specific proposal")
 .action(async (id) => {
  const data = (await apiRequest("GET", `/proposals/${id}`)) as any;
  console.log(JSON.stringify(data, null, 2));
 });
```

```ts
// apps/cli/src/commands/config.ts (NEW FILE)
import { Command } from "commander";
import { apiRequest } from "../http.js";

export const configCommand = new Command("config");

configCommand
 .command("get <key>")
 .description("Get a config value")
 .action(async (key) => {
  const data = (await apiRequest("GET", `/config/${key}`)) as any;
  console.log(data.value ?? "(not set)");
 });

configCommand
 .command("set <key> <value>")
 .description("Set a config value")
 .action(async (key, value) => {
  await apiRequest("POST", `/config/${key}`, { value });
  console.log(`Set ${key} = ${value}`);
 });
```

**Note:** Config routes (`/config/:key`) don't exist yet on the server. You can either add them in this task or defer. The `config` table already exists in the DB schema. Add a simple pair of routes in `apps/core/src/config-routes.ts` if time permits, or skip the CLI config command and add it later.

**Step 2: Update CLI entry point**

Modify `apps/cli/src/index.ts`:

```ts
import { proposalsCommand } from "./commands/proposals.js";
import { configCommand } from "./commands/config.js";

// After existing addCommand calls:
program.addCommand(proposalsCommand);
program.addCommand(configCommand);
```

**Step 3: Add reminders write CLI commands**

Modify `apps/cli/src/commands/reminders.ts` — add write subcommands:

```ts
remindersCommand
 .command("add")
 .description("Add a reminder (creates approval proposal)")
 .requiredOption("--title <title>", "Reminder title")
 .option("--list <list>", "Target list")
 .option("--due <due>", "Due date")
 .option("--notes <notes>", "Notes")
 .option("--priority <priority>", "Priority (none, low, medium, high)")
 .action(async (opts) => {
  const data = (await apiRequest("POST", "/reminders/add", {
   title: opts.title,
   list: opts.list,
   due: opts.due,
   notes: opts.notes,
   priority: opts.priority,
  })) as any;
  console.log(`Proposal created: ${data.id}`);
  console.log(`Status: ${data.status}`);
  console.log(`Approve with: fruitctl proposals approve ${data.id}`);
 });

remindersCommand
 .command("complete <id>")
 .description("Complete a reminder (creates approval proposal)")
 .action(async (id) => {
  const data = (await apiRequest("POST", "/reminders/complete", {
   id,
  })) as any;
  console.log(`Proposal created: ${data.id}`);
  console.log(`Approve with: fruitctl proposals approve ${data.id}`);
 });

remindersCommand
 .command("edit <id>")
 .description("Edit a reminder (creates approval proposal)")
 .option("--title <title>", "New title")
 .option("--list <list>", "Move to list")
 .option("--due <due>", "Set due date")
 .option("--notes <notes>", "Set notes")
 .option("--priority <priority>", "Set priority")
 .action(async (id, opts) => {
  const data = (await apiRequest("POST", "/reminders/edit", {
   id,
   title: opts.title,
   list: opts.list,
   due: opts.due,
   notes: opts.notes,
   priority: opts.priority,
  })) as any;
  console.log(`Proposal created: ${data.id}`);
  console.log(`Approve with: fruitctl proposals approve ${data.id}`);
 });

remindersCommand
 .command("delete <id>")
 .description("Delete a reminder (creates approval proposal)")
 .action(async (id) => {
  const data = (await apiRequest("POST", "/reminders/delete", {
   id,
  })) as any;
  console.log(`Proposal created: ${data.id}`);
  console.log(`Approve with: fruitctl proposals approve ${data.id}`);
 });
```

**Step 4: Build and verify**

Run: `pnpm nx run-many -t build`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/cli/src/
git commit -m "feat(cli): add proposals and reminders write CLI commands"
```

---

## Task 9: End-to-End Integration Test

Write a test that exercises the full write flow: submit proposal via adapter route → approve → execute → audit log entry.

**Files:**

- Modify: `apps/core/src/__tests__/integration.test.ts`

**Step 1: Write the test**

```ts
it("full write flow: propose → approve → execute → audit", async () => {
 const db = createDatabase(":memory:");
 const engine = new ApprovalEngine(db);
 const executeFn = vi.fn().mockResolvedValue({ id: "created-1" });

 const writeAdapter: AdapterPlugin = Object.assign(
  (async (fastify, opts) => {
   fastify.post("/add", async (request) => {
    return opts.approval.propose({
     adapter: "test",
     action: "add",
     params: request.body,
    });
   });
  }) as FastifyPluginAsync<AdapterPluginOptions>,
  {
   manifest: {
    name: "test",
    version: "0.1.0",
    nativeDeps: [],
    capabilities: [],
    actions: {
     add: {
      name: "add",
      description: "Add",
      paramsSchema: {} as any,
      validate: async (p: unknown) => p,
      execute: executeFn,
     },
    },
   },
  },
 );

 const server = createServer({
  db,
  jwtSecret: "test-secret-long-enough",
 });
 registerProposalRoutes(server, engine);
 await registerAdapters(server, [writeAdapter], {
  db,
  config: {},
  approval: engine,
 });
 await server.ready();

 // 1. Submit write request → creates proposal
 const submitRes = await server.inject({
  method: "POST",
  url: "/test/add",
  payload: { title: "Test item" },
 });
 expect(submitRes.statusCode).toBe(200);
 const proposal = submitRes.json();
 expect(proposal.status).toBe("pending");

 // 2. Approve via API
 const approveRes = await server.inject({
  method: "POST",
  url: `/proposals/${proposal.id}/approve`,
 });
 expect(approveRes.statusCode).toBe(200);
 expect(approveRes.json().status).toBe("approved");

 // 3. Verify execution happened
 expect(executeFn).toHaveBeenCalledWith({ title: "Test item" });

 // 4. Verify audit log
 const logsRes = await db
  .select()
  .from(auditLog)
  .where(eq(auditLog.proposalId, proposal.id));
 expect(logsRes).toHaveLength(1);
 expect(logsRes[0].result).toContain("created-1");
});
```

**Step 2: Run test to verify it passes**

Run: `pnpm nx run @fruitctl/core:test`
Expected: PASS

**Step 3: Run full test suite**

Run: `pnpm nx run-many -t test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add apps/core/src/__tests__/integration.test.ts
git commit -m "test: add full write flow integration test (propose → approve → execute → audit)"
```

---

## Task 10: Manual End-to-End Smoke Test

Verify the full system works with real `remindctl` on macOS.

**Steps:**

1. Start the server:

   ```bash
   FRUITCTL_JWT_SECRET=fruitctl-dev-secret-key FRUITCTL_ADAPTERS=reminders pnpm --filter @fruitctl/core dev
   ```

2. Generate auth token (if not already saved):

   ```bash
   pnpm --filter @fruitctl/cli exec tsx src/index.ts auth token --secret fruitctl-dev-secret-key
   ```

3. List reminders (read — should still work):

   ```bash
   pnpm --filter @fruitctl/cli exec tsx src/index.ts reminders lists
   ```

4. Add a reminder (creates proposal):

   ```bash
   pnpm --filter @fruitctl/cli exec tsx src/index.ts reminders add --title "Test from fruitctl" --list "Reminders"
   ```

   Expected: `Proposal created: <uuid>` + `Approve with: fruitctl proposals approve <uuid>`

5. List pending proposals:

   ```bash
   pnpm --filter @fruitctl/cli exec tsx src/index.ts proposals list --status pending
   ```

   Expected: Shows the pending proposal

6. Approve the proposal:

   ```bash
   pnpm --filter @fruitctl/cli exec tsx src/index.ts proposals approve <uuid>
   ```

   Expected: `Proposal <short-id> approved.`

7. Verify in Apple Reminders app that "Test from fruitctl" appears in the "Reminders" list.

8. Clean up — delete the test reminder:

   ```bash
   pnpm --filter @fruitctl/cli exec tsx src/index.ts reminders delete <reminder-id>
   pnpm --filter @fruitctl/cli exec tsx src/index.ts proposals approve <new-proposal-uuid>
   ```

**No commit needed for this task — it's a manual verification step.**
