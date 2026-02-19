# fruitctl v1 Design

## Overview

fruitctl is a Local Apple Integration Gateway (LAIG) — a TypeScript RPC server running on macOS that exposes approval-gated access to Things, Reminders, and Calendar. It acts as a capability broker between Claude (Openclaw) and macOS-native apps.

All mutating operations require explicit human approval.

## Architecture

### Integration Model

HTTP API + CLI. The server is a standalone Fastify HTTP API. The `fruitctl` CLI wraps the API for both human and agent use. Claude calls the CLI via bash.

This was chosen over MCP (approval workflow doesn't fit MCP's synchronous model) and over a skill-based approach (too fragile for security-sensitive operations).

### Monorepo Structure

pnpm workspaces + Nx. `apps/` for deployables, `packages/` for libraries.

```
fruitctl/
├── nx.json
├── pnpm-workspace.yaml
├── apps/
│   ├── core/              # @fruitctl/core — Fastify server, auth, approval engine
│   └── cli/               # @fruitctl/cli — fruitctl binary
├── packages/
│   ├── db/                # @fruitctl/db — Drizzle schema, migrations, SQLite connection
│   ├── plugins/
│   │   ├── reminders/     # @fruitctl/reminders — remindctl adapter
│   │   ├── things/        # @fruitctl/things — Things URL scheme adapter
│   │   └── calendar/      # @fruitctl/calendar — EventKit/AppleScript adapter
│   └── (future shared utilities)
```

### Tech Stack

- TypeScript
- Fastify (server)
- Zod (validation)
- Drizzle (ORM) + SQLite
- pnpm + Nx (monorepo)
- Biome (formatting)

## Adapter Contract

Each adapter is a Fastify plugin that implements:

```ts
interface AdapterManifest {
  name: string                    // e.g. "reminders"
  version: string
  nativeDeps: NativeDep[]         // system-level dependencies
  capabilities: CapabilityDef[]   // generates /skills response
}

interface NativeDep {
  name: string                    // e.g. "remindctl"
  check: () => Promise<boolean>   // dependency available?
}

type AdapterPlugin = FastifyPluginAsync<{
  approvalEngine: ApprovalEngine
  config: AdapterConfig
}>
```

On boot, core:

1. Loads enabled adapters from config
2. Checks native deps — logs warnings, skips adapter if critical dep missing
3. Registers each adapter as a Fastify plugin with route prefix (e.g. `/reminders`)
4. Aggregates capabilities for `/skills` endpoint

Adding a new adapter requires no core changes — create the package, implement the contract, add to config.

## Approval Engine

Lives in `apps/core`, passed to adapters.

### Proposal Lifecycle

```
PENDING → APPROVED → EXECUTED
       ↘ REJECTED
       ↘ EXPIRED (TTL-based)
```

### Write Flow

1. Adapter validates input with Zod
2. Adapter calls `approvalEngine.propose({ adapter, action, params })`
3. Engine stores proposal in SQLite, returns proposal_id + PENDING status
4. HTTP response returns immediately with proposal ID
5. User approves via CLI, web UI, or macOS notification
6. On approval, engine calls adapter's execute function
7. Result stored in audit log

Each adapter provides both `validate` and `execute` per write action. Validation at request time (fail fast), execution only after approval. Proposals store already-validated params.

## Database (`@fruitctl/db`)

Drizzle ORM with SQLite. Dedicated package owns schema, migrations, and exports the typed client.

### Tables

- **proposals** — id, adapter, action, params (JSON), status, created_at, resolved_at, resolved_by
- **audit_log** — id, proposal_id, adapter, action, params, result, error, timestamp
- **config** — key/value store for allowlists and adapter settings

## Auth & Security

- **JWT auth** — shared secret, every request requires `Authorization: Bearer <token>`
- **Network binding** — Tailscale interface IP (configurable, localhost fallback for dev)
- **Allowlists** — per-adapter, stored in config table, enforced at validation time before proposal creation
- **Token management** — `fruitctl auth token` generates tokens, stored at `~/.config/fruitctl/credentials.json`

### Deferred to later

- mTLS (JWT sufficient for Tailscale's trusted network)
- Dedicated macOS user
- Rate limiting (Milestone 5)

## Error Model

```json
{
  "error": {
    "code": "LIST_NOT_ALLOWED",
    "message": "Writes to list 'Personal' are not permitted",
    "retryable": false,
    "details": {}
  }
}
```

Standard codes: VALIDATION_ERROR, NOT_FOUND, LIST_NOT_ALLOWED, CALENDAR_NOT_ALLOWED, PROPOSAL_NOT_FOUND, EXECUTION_FAILED, APPROVAL_REQUIRED.

No internal stack traces. Deterministic codes always.

## CLI (`fruitctl`)

Static command definitions — each adapter ships CLI command defs, composed at build time. Works offline, fully typed, `--help` always available.

```
fruitctl reminders list [--list <name>]
fruitctl reminders get <id>
fruitctl reminders add --title "Milk" --list "Groceries"

fruitctl things list [--project <name>]
fruitctl things create --title "Call contractor" --project "House"

fruitctl calendar list [--from <date> --to <date>]
fruitctl calendar create --title "Dentist" --calendar "Personal" --start "..."

fruitctl proposals list [--status pending]
fruitctl proposals approve <id>
fruitctl proposals reject <id>

fruitctl server start [--port 3000]
fruitctl server status

fruitctl auth token
fruitctl config set <key> <value>
fruitctl config get <key>
```

Reads return results directly. Writes return proposal ID + status with instructions to approve.

## Phased Milestones

### Milestone 1: Core + Read-Only Reminders

- pnpm + Nx monorepo scaffold
- Fastify server with JWT auth, Tailscale binding
- `@fruitctl/db`: Drizzle + SQLite setup, config table
- Structured error model, JSON logging
- Adapter plugin contract + registration
- Reminders adapter: list_lists, list_reminders, get_reminder (via remindctl)
- CLI: `fruitctl reminders list/get`, `fruitctl server start/status`, `fruitctl auth token`

### Milestone 2: Approval Engine + Reminders Write

- Proposal state machine (PENDING, APPROVED, REJECTED, EXPIRED)
- Drizzle migrations for proposals + audit_log tables
- Proposal TTL expiration
- Reminders write: add, update, complete, delete
- Allowlist enforcement
- CLI: `fruitctl proposals list/approve/reject`, `fruitctl config set/get`

### Milestone 3: Things Integration

- `@fruitctl/things` adapter
- Read via Things URL scheme / Shortcuts
- Write via things:///add URL scheme
- Project/tag allowlists
- CLI: `fruitctl things list/get/create/update/complete/delete`

### Milestone 4: Calendar Integration

- `@fruitctl/calendar` adapter
- Read/write via EventKit wrapper or AppleScript bridge
- Calendar-level allowlist, max time range
- CLI: `fruitctl calendar list/get/create/update/delete`

### Milestone 5: Approval UX Polish + Discovery

- macOS notification actions (approve/reject)
- Web UI dashboard for proposal review
- `/skills` endpoint (aggregated from adapter manifests)
- Rate limiting

## Non-Goals (unchanged from PRD)

- No generic shell access
- No filesystem browsing
- No arbitrary AppleScript execution
- No background silent mutation
