# API Key Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace JWT auth with HMAC-derived API keys supporting agent and admin roles.

**Architecture:** Server derives two keys from a master secret using HMAC-SHA256. Incoming Bearer tokens are matched to determine role. Adapter and proposal-read routes require any valid key; approve/reject require admin. JWT library is removed.

**Tech Stack:** Node.js `node:crypto` (HMAC-SHA256), Fastify 5.7 decorators

**Design doc:** `docs/plans/2026-02-19-auth-redesign-design.md`

---

### Task 1: Key derivation utility

**Files:**
- Create: `apps/core/src/auth.ts`
- Create: `apps/core/src/__tests__/auth.test.ts`

**Step 1: Write the failing test**

Create `apps/core/src/__tests__/auth.test.ts`:

```ts
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @fruitctl/core exec vitest run src/__tests__/auth.test.ts`
Expected: FAIL — cannot find `../auth.js`

**Step 3: Write minimal implementation**

Create `apps/core/src/auth.ts`:

```ts
import { createHmac } from "node:crypto";

export type Role = "admin" | "agent";

export function deriveKey(role: Role, secret: string): string {
	const hash = createHmac("sha256", secret).update(role).digest("hex");
	return `fctl_${role}_${hash}`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @fruitctl/core exec vitest run src/__tests__/auth.test.ts`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add apps/core/src/auth.ts apps/core/src/__tests__/auth.test.ts
git commit -m "feat: add HMAC key derivation utility"
```

---

### Task 2: Replace JWT auth with API key auth in server

**Files:**
- Modify: `apps/core/src/server.ts`
- Modify: `apps/core/src/__tests__/server.test.ts`

This task replaces `@fastify/jwt` with the new key-based auth. The `authenticate` decorator changes from JWT verification to Bearer token comparison. A new `request.role` property is added.

**Step 1: Write the failing tests**

Replace `apps/core/src/__tests__/server.test.ts` entirely:

```ts
import { createDatabase } from "@fruitctl/db";
import { describe, expect, it } from "vitest";
import { deriveKey } from "../auth.js";
import { createServer } from "../server.js";

const SECRET = "test-secret-long-enough";
const ADMIN_KEY = deriveKey("admin", SECRET);
const AGENT_KEY = deriveKey("agent", SECRET);

describe("createServer", () => {
	it("creates a fastify instance with health endpoint", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		const res = await server.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ status: "ok" });
	});

	it("returns 401 for protected routes without token", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		server.get(
			"/protected",
			{ preHandler: [server.authenticate] },
			async () => ({ data: "secret" }),
		);
		const res = await server.inject({ method: "GET", url: "/protected" });
		expect(res.statusCode).toBe(401);
	});

	it("allows access with valid admin key", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		server.get(
			"/protected",
			{ preHandler: [server.authenticate] },
			async (request) => ({ role: request.role }),
		);
		const res = await server.inject({
			method: "GET",
			url: "/protected",
			headers: { authorization: `Bearer ${ADMIN_KEY}` },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().role).toBe("admin");
	});

	it("allows access with valid agent key", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		server.get(
			"/protected",
			{ preHandler: [server.authenticate] },
			async (request) => ({ role: request.role }),
		);
		const res = await server.inject({
			method: "GET",
			url: "/protected",
			headers: { authorization: `Bearer ${AGENT_KEY}` },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().role).toBe("agent");
	});

	it("returns 401 for invalid token", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		server.get(
			"/protected",
			{ preHandler: [server.authenticate] },
			async () => ({ data: "secret" }),
		);
		const res = await server.inject({
			method: "GET",
			url: "/protected",
			headers: { authorization: "Bearer bad-token" },
		});
		expect(res.statusCode).toBe(401);
	});

	it("returns structured errors for AppError", async () => {
		const db = createDatabase(":memory:");
		const server = createServer({ db, secret: SECRET });
		const { AppError, ErrorCode } = await import("@fruitctl/shared");
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

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @fruitctl/core exec vitest run src/__tests__/server.test.ts`
Expected: FAIL — `createServer` doesn't accept `secret`, no `request.role`

**Step 3: Rewrite `server.ts`**

Replace `apps/core/src/server.ts` entirely:

```ts
import type { AppDatabase } from "@fruitctl/db";
import { AppError, ErrorCode } from "@fruitctl/shared";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import type { Role } from "./auth.js";
import { deriveKey } from "./auth.js";

declare module "fastify" {
	interface FastifyInstance {
		authenticate: (
			request: FastifyRequest,
			reply: FastifyReply,
		) => Promise<void>;
	}
	interface FastifyRequest {
		role: Role;
	}
}

export interface ServerOptions {
	db: AppDatabase;
	secret: string;
	host?: string;
	port?: number;
	logger?: boolean;
}

export function createServer(options: ServerOptions) {
	const server = Fastify({
		logger: options.logger ?? false,
	});

	const adminKey = deriveKey("admin", options.secret);
	const agentKey = deriveKey("agent", options.secret);

	server.decorateRequest("role", "");

	server.decorate(
		"authenticate",
		async (request: FastifyRequest, _reply: FastifyReply) => {
			const header = request.headers.authorization;
			if (!header?.startsWith("Bearer ")) {
				throw new AppError(ErrorCode.UNAUTHORIZED, "Missing authorization token");
			}
			const token = header.slice(7);
			if (token === adminKey) {
				request.role = "admin";
			} else if (token === agentKey) {
				request.role = "agent";
			} else {
				throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid authorization token");
			}
		},
	);

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

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @fruitctl/core exec vitest run src/__tests__/server.test.ts`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add apps/core/src/server.ts apps/core/src/__tests__/server.test.ts
git commit -m "feat: replace JWT auth with HMAC API key auth"
```

---

### Task 3: Add admin-only guard and protect proposal routes

**Files:**
- Modify: `apps/core/src/proposals-routes.ts`
- Modify: `apps/core/src/__tests__/proposals-routes.test.ts`

This task adds auth to proposal routes: all routes require a valid key, approve/reject require admin role.

**Step 1: Write the failing tests**

Replace `apps/core/src/__tests__/proposals-routes.test.ts` entirely:

```ts
import { createDatabase } from "@fruitctl/db";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ApprovalEngine } from "../approval.js";
import { deriveKey } from "../auth.js";
import { registerProposalRoutes } from "../proposals-routes.js";
import { createServer } from "../server.js";

const SECRET = "test-secret-long-enough";
const ADMIN_KEY = deriveKey("admin", SECRET);
const AGENT_KEY = deriveKey("agent", SECRET);

const migrationsFolder = resolve(
	import.meta.dirname,
	"../../../../packages/db/drizzle",
);

function buildApp() {
	const db = createDatabase(":memory:");
	migrate(db, { migrationsFolder });
	const engine = new ApprovalEngine(db);
	const server = createServer({ db, secret: SECRET });
	registerProposalRoutes(server, engine);
	return { server, engine };
}

function authHeader(key: string) {
	return { authorization: `Bearer ${key}` };
}

describe("proposal routes", () => {
	it("GET /proposals returns 401 without auth", async () => {
		const { server } = buildApp();
		const res = await server.inject({ method: "GET", url: "/proposals" });
		expect(res.statusCode).toBe(401);
	});

	it("GET /proposals works with agent key", async () => {
		const { server, engine } = buildApp();
		await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "GET",
			url: "/proposals",
			headers: authHeader(AGENT_KEY),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().items).toHaveLength(1);
	});

	it("GET /proposals works with admin key", async () => {
		const { server, engine } = buildApp();
		await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "GET",
			url: "/proposals",
			headers: authHeader(ADMIN_KEY),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().items).toHaveLength(1);
	});

	it("POST /proposals/:id/approve requires admin key", async () => {
		const { server, engine } = buildApp();
		const proposal = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "POST",
			url: `/proposals/${proposal.id}/approve`,
			headers: authHeader(AGENT_KEY),
		});
		expect(res.statusCode).toBe(403);
	});

	it("POST /proposals/:id/approve works with admin key", async () => {
		const { server, engine } = buildApp();
		const proposal = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "POST",
			url: `/proposals/${proposal.id}/approve`,
			headers: authHeader(ADMIN_KEY),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().status).toBe("approved");
	});

	it("POST /proposals/:id/reject requires admin key", async () => {
		const { server, engine } = buildApp();
		const proposal = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "POST",
			url: `/proposals/${proposal.id}/reject`,
			headers: authHeader(AGENT_KEY),
		});
		expect(res.statusCode).toBe(403);
	});

	it("POST /proposals/:id/reject works with admin key", async () => {
		const { server, engine } = buildApp();
		const proposal = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "POST",
			url: `/proposals/${proposal.id}/reject`,
			headers: authHeader(ADMIN_KEY),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().status).toBe("rejected");
	});

	it("GET /proposals/:id works with agent key", async () => {
		const { server, engine } = buildApp();
		const proposal = await engine.propose({
			adapter: "reminders",
			action: "add",
			params: { title: "Milk" },
		});
		const res = await server.inject({
			method: "GET",
			url: `/proposals/${proposal.id}`,
			headers: authHeader(AGENT_KEY),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().adapter).toBe("reminders");
	});

	it("GET /proposals?status=pending filters results", async () => {
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
			headers: authHeader(ADMIN_KEY),
		});
		expect(res.json().items).toHaveLength(1);
	});
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @fruitctl/core exec vitest run src/__tests__/proposals-routes.test.ts`
Expected: FAIL — routes don't require auth yet

**Step 3: Update `proposals-routes.ts`**

Replace `apps/core/src/proposals-routes.ts` entirely:

```ts
import { AppError, ErrorCode } from "@fruitctl/shared";
import type { FastifyInstance } from "fastify";
import type { ApprovalEngine } from "./approval.js";

function requireAdmin(server: FastifyInstance) {
	return [
		server.authenticate,
		async (request: import("fastify").FastifyRequest) => {
			if (request.role !== "admin") {
				throw new AppError(ErrorCode.FORBIDDEN, "Admin access required");
			}
		},
	];
}

export function registerProposalRoutes(
	server: FastifyInstance,
	engine: ApprovalEngine,
) {
	server.get(
		"/proposals",
		{ preHandler: [server.authenticate] },
		async (request) => {
			const { status } = request.query as { status?: string };
			const items = await engine.list(status ? { status } : undefined);
			return { items };
		},
	);

	server.get(
		"/proposals/:id",
		{ preHandler: [server.authenticate] },
		async (request) => {
			const { id } = request.params as { id: string };
			return engine.get(id);
		},
	);

	server.post(
		"/proposals/:id/approve",
		{ preHandler: requireAdmin(server) },
		async (request) => {
			const { id } = request.params as { id: string };
			return engine.approve(id, request.role);
		},
	);

	server.post(
		"/proposals/:id/reject",
		{ preHandler: requireAdmin(server) },
		async (request) => {
			const { id } = request.params as { id: string };
			return engine.reject(id, request.role);
		},
	);
}
```

**Important:** The `ErrorCode.FORBIDDEN` may not exist yet in `@fruitctl/shared`. Check `packages/shared/src/errors.ts` — if it's missing, add `FORBIDDEN = "FORBIDDEN"` to the `ErrorCode` enum and add a case in `statusCodeFor` returning `403`.

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @fruitctl/core exec vitest run src/__tests__/proposals-routes.test.ts`
Expected: All 9 tests PASS

**Step 5: Commit**

```bash
git add apps/core/src/proposals-routes.ts apps/core/src/__tests__/proposals-routes.test.ts
# Also add packages/shared/src/errors.ts if modified
git commit -m "feat: add auth + admin-only guard to proposal routes"
```

---

### Task 4: Protect adapter routes with auth

**Files:**
- Modify: `apps/core/src/registry.ts`
- Modify: `apps/core/src/__tests__/registry.test.ts`

Adapter plugin routes are registered under a prefix (e.g., `/reminders/*`). Auth needs to be added at the prefix level so all adapter routes require a valid key (agent or admin).

**Step 1: Write the failing test**

Add to `apps/core/src/__tests__/registry.test.ts` a test that verifies adapter routes require auth:

```ts
it("adapter routes require authentication", async () => {
	// Register a mock adapter, then try hitting a route without auth
	const res = await server.inject({
		method: "GET",
		url: "/test-adapter/items",
	});
	expect(res.statusCode).toBe(401);
});
```

The exact test depends on the current test setup. The key change is in `registry.ts`: add `onRequest` hook to the adapter registration so all routes under the adapter prefix require `server.authenticate`.

**Step 2: Modify `registry.ts`**

In `apps/core/src/registry.ts`, when registering each adapter plugin, add an `onRequest` hook. Change the `server.register` call (around line 45):

```ts
await server.register(
	async (scoped) => {
		scoped.addHook("onRequest", server.authenticate);
		await scoped.register(adapter, {
			db: options.db,
			config: options.config,
			approval: options.approval,
		});
	},
	{ prefix: `/${manifest.name}` },
);
```

This wraps each adapter in a scoped plugin that adds auth to all routes within that prefix.

**Step 3: Run full test suite**

Run: `pnpm --filter @fruitctl/core exec vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add apps/core/src/registry.ts apps/core/src/__tests__/registry.test.ts
git commit -m "feat: require auth on all adapter routes"
```

---

### Task 5: Update config to use `secret` instead of `jwtSecret`

**Files:**
- Modify: `apps/core/src/config.ts`
- Modify: `apps/core/src/__tests__/config.test.ts`
- Modify: `apps/core/src/main.ts`

**Step 1: Update the config schema**

In `apps/core/src/config.ts`, rename `jwtSecret` to `secret` and change env var from `FRUITCTL_JWT_SECRET` to `FRUITCTL_SECRET`:

```ts
export const serverConfigSchema = z.object({
	port: z.number().default(3456),
	host: z.string().default("127.0.0.1"),
	secret: z.string().min(16),
	dbPath: z.string().default("./fruitctl.db"),
	adapters: z.array(z.string()).default(["reminders", "calendar"]),
});
```

In `loadConfig`, change:
```ts
secret: env.FRUITCTL_SECRET,
```

**Step 2: Update `main.ts`**

Change `jwtSecret: config.jwtSecret` to `secret: config.secret` in the `createServer` call.

**Step 3: Update config tests**

In `apps/core/src/__tests__/config.test.ts`, update all references from `FRUITCTL_JWT_SECRET` to `FRUITCTL_SECRET` and from `jwtSecret` to `secret`.

**Step 4: Run tests**

Run: `pnpm --filter @fruitctl/core exec vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/core/src/config.ts apps/core/src/__tests__/config.test.ts apps/core/src/main.ts
git commit -m "refactor: rename jwtSecret to secret in config"
```

---

### Task 6: Update CLI auth command

**Files:**
- Modify: `apps/cli/src/commands/auth.ts`

**Step 1: Rewrite `auth.ts`**

Replace the JWT minting with key derivation. The CLI needs its own copy of `deriveKey` or it needs to import from `@fruitctl/core`. Since packages should NOT depend on `@fruitctl/core`, the cleanest approach is to either:
- (a) Move `deriveKey` to `@fruitctl/shared`, or
- (b) Inline the same 3-line HMAC function in the CLI auth command

Option (a) is better since the function is trivial and both server + CLI need it.

**Step 1a: Move `deriveKey` to `@fruitctl/shared`**

Create or add to `packages/shared/src/auth.ts`:

```ts
import { createHmac } from "node:crypto";

export type Role = "admin" | "agent";

export function deriveKey(role: Role, secret: string): string {
	const hash = createHmac("sha256", secret).update(role).digest("hex");
	return `fctl_${role}_${hash}`;
}
```

Export it from `packages/shared/src/index.ts`:
```ts
export { deriveKey, type Role } from "./auth.js";
```

Then update `apps/core/src/auth.ts` to re-export from shared (or delete it and import from `@fruitctl/shared` everywhere in core). Update all imports in core accordingly.

**Step 1b: Rewrite CLI auth command**

```ts
import { deriveKey, type Role, saveCredentials } from "@fruitctl/shared";
import { Command } from "commander";

export const authCommand = new Command("auth");

authCommand
	.command("token")
	.description("Generate and save an API key")
	.option("--secret <secret>", "Master secret (or set FRUITCTL_SECRET)")
	.option("--role <role>", "Key role: admin or agent", "admin")
	.option("--server <url>", "Server URL", "http://127.0.0.1:3456")
	.action(async (opts) => {
		const secret = opts.secret ?? process.env.FRUITCTL_SECRET;
		if (!secret) {
			console.error("Error: --secret or FRUITCTL_SECRET required");
			process.exit(1);
		}
		if (opts.role !== "admin" && opts.role !== "agent") {
			console.error("Error: --role must be 'admin' or 'agent'");
			process.exit(1);
		}
		const token = deriveKey(opts.role as Role, secret);
		saveCredentials({ token, serverUrl: opts.server });
		console.log(
			`${opts.role} key saved to ~/.config/fruitctl/credentials.json`,
		);
	});
```

**Step 2: Run full test suite**

Run: `pnpm -r run test`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/shared/src/auth.ts packages/shared/src/index.ts apps/core/src/auth.ts apps/core/src/server.ts apps/cli/src/commands/auth.ts
git commit -m "feat: update CLI auth to use HMAC-derived API keys"
```

---

### Task 7: Remove `@fastify/jwt`

**Files:**
- Modify: `apps/core/package.json`

**Step 1: Remove the dependency**

Run: `pnpm --filter @fruitctl/core remove @fastify/jwt`

**Step 2: Verify no remaining imports**

Search for any remaining `@fastify/jwt` or `fastifyJwt` imports in `apps/core/src/`. There should be none after Task 2.

Run: `grep -r "fastify/jwt\|fastifyJwt" apps/core/src/`
Expected: No matches

**Step 3: Run full test suite**

Run: `pnpm -r run test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add apps/core/package.json pnpm-lock.yaml
git commit -m "chore: remove @fastify/jwt dependency"
```

---

### Task 8: Rebuild CLI and verify end-to-end

**Step 1: Rebuild**

Run: `pnpm -r run build`

**Step 2: Generate keys and test**

```bash
fruitctl auth token --secret <your-secret> --role admin
# Check: cat ~/.config/fruitctl/credentials.json — should show fctl_admin_...

fruitctl auth token --secret <your-secret> --role agent
# Check: cat ~/.config/fruitctl/credentials.json — should show fctl_agent_...
```

**Step 3: Start server and test auth**

Start: `FRUITCTL_SECRET=<your-secret> pnpm --filter @fruitctl/core dev`

Test admin access:
```bash
curl -H "Authorization: Bearer $(cat ~/.config/fruitctl/credentials.json | jq -r .token)" http://127.0.0.1:3456/proposals
# Should return 200 with proposals

curl http://127.0.0.1:3456/proposals
# Should return 401
```

**Step 4: Test web UI**

Open `http://127.0.0.1:3456/`, paste admin key, verify proposals load and approve/reject works.
