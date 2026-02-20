# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build all packages (dependency order via Nx)
pnpm build

# Run all tests (builds first)
pnpm test

# Run a single test file
pnpm --filter @fruitctl/core exec vitest run src/__tests__/approval.test.ts

# Lint / format
pnpm lint          # biome check .
pnpm lint:fix      # biome check --write .

# Dev server (watches for changes)
pnpm --filter @fruitctl/core dev
```

**Env vars for dev server:** `FRUITCTL_SECRET` (optional if `fruitctl init` was run; env var overrides credentials file), `FRUITCTL_PORT` (default 3456), `FRUITCTL_HOST` (default 0.0.0.0), `FRUITCTL_DB_PATH` (default `./fruitctl.db`), `FRUITCTL_ADAPTERS` (comma-separated, default `reminders,calendar`).

## Architecture

**fruitctl** is a monorepo tool that wraps native macOS CLI tools (remindctl, ekctl) behind a Fastify API with an approval engine for write operations.

### Dependency graph (no cycles — no package may depend on `@fruitctl/core`)

```
@fruitctl/core (Fastify server, approval engine)
  ← @fruitctl/db, @fruitctl/shared, @fruitctl/reminders, @fruitctl/calendar

@fruitctl/cli (Commander CLI, registers plugin commands)
  ← @fruitctl/db, @fruitctl/shared, @fruitctl/reminders, @fruitctl/calendar
  (does NOT depend on @fruitctl/core)

@fruitctl/reminders, @fruitctl/calendar (plugin packages)
  ← @fruitctl/db, @fruitctl/shared

@fruitctl/shared (types, errors, API client)
  ← @fruitctl/db

@fruitctl/db (Drizzle + SQLite, schema, migrations) — no internal deps
```

### Plugin/adapter pattern

Each plugin package (`packages/plugins/{name}/`) exports two things:

1. **An `AdapterPlugin`** — a Fastify plugin + manifest with capabilities and actions. GET routes return data directly; POST routes call `opts.approval.propose(...)` to create pending proposals.
2. **A Commander command** — CLI subcommand using `apiRequest()` from `@fruitctl/shared`.

Native CLI wrappers (e.g. `Remindctl`, `Ekctl`) accept an injectable `execFn` parameter for testing.

### Approval engine flow

POST request → plugin calls `approval.propose()` → proposal created as "pending" → user runs `fruitctl proposals approve <id>` → engine looks up action in `ActionRegistry` → calls `execute(params)` → logs to `audit_log`.

### Database

SQLite via Drizzle + better-sqlite3. Auto-migration runs inside `createDatabase()` — no manual migration step. Tables: `config`, `proposals`, `audit_log`. Migration SQL files in `packages/db/drizzle/`.

## Conventions

- **Zod imports:** `import { z } from "zod/v4"` (not `"zod"`)
- **Formatting:** Biome with spaces (not tabs). Run `pnpm lint:fix` before committing.
- **ESM:** All packages are `"type": "module"`. Imports must use `.js` extensions in `.ts` files.
- **TypeScript:** `strict: true`, target ES2022, Node16 module resolution. All packages extend `tsconfig.base.json`.
- **Shared types go in `@fruitctl/shared`**, never in `@fruitctl/core`.
- **Testing:** Vitest. Tests use `createDatabase(":memory:")` for in-memory SQLite. Tests at `src/__tests__/*.test.ts`. Use `fastify.inject()` for HTTP tests.
- **Error handling:** `AppError` class with `ErrorCode` enum, mapped to HTTP status codes by a global Fastify error handler.
- **Workspace deps:** Use `workspace:*` in package.json.

## Past Bugs to Avoid

- **`apps/core/tsconfig.json` must NOT exclude `main.ts`** — this broke the build previously and was hard to diagnose.

## Adding a New Plugin

1. Create `packages/plugins/{name}/` with `package.json` (`@fruitctl/{name}`), `tsconfig.json` extending `../../tsconfig.base.json`
2. Implement `src/{name}ctl.ts` — wrapper class around a native CLI tool, accepts injectable `execFn`
3. Implement `src/schemas.ts` — Zod schemas for params (import from `"zod/v4"`)
4. Implement `src/plugin.ts` — `FastifyPluginAsync<AdapterPluginOptions>` with GET routes for reads, POST routes calling `opts.approval.propose()`
5. Implement `src/commands.ts` — Commander command using `apiRequest()` from `@fruitctl/shared`
6. Implement `src/index.ts` — export the `AdapterPlugin` (plugin + manifest) and the Commander command
7. Register in `apps/core/src/main.ts` `adapterMap`
8. Register in `apps/cli/src/index.ts` with `program.addCommand()`
9. Add `@fruitctl/{name}: workspace:*` dependency to both `apps/core` and `apps/cli`

## Design Docs

Design documents and implementation plans live in `docs/plans/`. Check there before starting major features — a design doc may already exist.
