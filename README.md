<p align="center">
  <img src="docs/logo.png" alt="fruitctl logo" width="200" />
</p>

# fruitctl

Approval-gated access to macOS apps (Reminders, Calendar) over HTTP. An AI agent proposes changes; a human approves them via web dashboard or CLI.

## How it works

1. Agent sends a write request (e.g., "add a reminder") via the HTTP API or CLI
2. The server creates a **proposal** instead of executing immediately
3. A human reviews and approves/rejects via the **web dashboard** at `GET /`
4. On approval, the server executes the action against the native macOS app

Read operations (listing reminders, viewing calendars) work immediecriettely without approval.

## Install the CLI

Requires Node.js 20+.

```bash
curl -fsSL https://github.com/counterbeing/fruitctl/releases/latest/download/fruitctl.cjs \
  -o /usr/local/bin/fruitctl && chmod +x /usr/local/bin/fruitctl
```

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

## API

All endpoints except `GET /` and `GET /health` require a Bearer token.

### Core routes

| Endpoint | Role | Description |
|---|---|---|
| `GET /health` | — | Health check |
| `GET /proposals` | agent | List proposals |
| `GET /proposals/:id` | agent | View a proposal |
| `POST /proposals/:id/approve` | admin | Approve a proposal |
| `POST /proposals/:id/reject` | admin | Reject a proposal |

### Plugins

Each plugin mounts its own routes under a prefix. See the plugin README for full route documentation.

| Plugin | Prefix | Description |
|---|---|---|
| [Reminders](packages/plugins/reminders/README.md) | `/reminders` | macOS Reminders via `remindctl` |
| [Calendar](packages/plugins/calendar/README.md) | `/calendar` | macOS Calendar via `ekctl` |

## Architecture

```
apps/core/           Fastify server, approval engine, web dashboard
apps/cli/            CLI (bundled as single file for distribution)
packages/db/         Drizzle + SQLite persistence
packages/shared/     Shared types, errors, API client, key derivation
packages/plugins/
  reminders/         Reminders adapter (wraps remindctl)
  calendar/          Calendar adapter (wraps ekctl)
```

## Development

```bash
pnpm install
pnpm -r run build
pnpm -r run test
```

## License

Private.
