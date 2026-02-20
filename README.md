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

Read operations (listing reminders, viewing calendars) work immediately without approval.

## Install the CLI

Requires Node.js 20+.

```bash
curl -fsSL https://github.com/counterbeing/fruitctl/releases/latest/download/fruitctl.cjs \
  -o /usr/local/bin/fruitctl && chmod +x /usr/local/bin/fruitctl
```

## Setup

### Start the server

```bash
export FRUITCTL_SECRET="your-secret-min-16-chars"
# From the repo:
pnpm --filter @fruitctl/core dev
```

### Generate API keys

```bash
# Admin key (full access — approve/reject proposals)
fruitctl auth token --secret $FRUITCTL_SECRET --role admin

# Agent key (read + propose only)
fruitctl auth token --secret $FRUITCTL_SECRET --role agent --server http://server-host:3456
```

Keys are saved to `~/.config/fruitctl/credentials.json`.

### Open the dashboard

Visit `http://localhost:3456` and paste your admin key.

## API

All endpoints except `GET /` and `GET /health` require a Bearer token.

| Endpoint | Role | Description |
|---|---|---|
| `GET /health` | — | Health check |
| `GET /reminders/lists` | agent | List reminder lists |
| `POST /reminders/list` | agent | List reminders in a list |
| `POST /reminders/add` | agent | Propose adding a reminder |
| `GET /calendar/calendars` | agent | List calendars |
| `GET /calendar/events?calendar=...&from=...&to=...` | agent | List events |
| `POST /calendar/add` | agent | Propose adding an event |
| `GET /proposals` | agent | List proposals |
| `GET /proposals/:id` | agent | View a proposal |
| `POST /proposals/:id/approve` | admin | Approve a proposal |
| `POST /proposals/:id/reject` | admin | Reject a proposal |

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
