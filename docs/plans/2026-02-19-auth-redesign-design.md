# API Key Auth Design

## Overview

Replace JWT-based auth with deterministic HMAC-derived API keys. A single master secret in the server config produces two keys — one for admins (full access) and one for agents (read + propose only). No new dependencies; removes `@fastify/jwt`.

## Key Derivation

Server config has one `secret` (env: `FRUITCTL_SECRET`, min 16 chars). At startup, the server derives:

```
adminKey = "fctl_admin_" + HMAC-SHA256("admin", secret).hex()
agentKey = "fctl_agent_" + HMAC-SHA256("agent", secret).hex()
```

The CLI derives the same keys locally given the secret and a `--role` flag, so no round-trip is needed to issue a key.

## Auth Middleware

A Fastify decorator replaces `@fastify/jwt`:
1. Extract Bearer token from Authorization header
2. Compare against adminKey and agentKey
3. Set `request.role = "admin" | "agent"` on match
4. Return 401 on no match

## Route Protection

| Route | Auth | Role |
|---|---|---|
| `GET /` (web UI) | none | — |
| `GET /health` | none | — |
| Adapter routes (`/reminders/*`, `/calendar/*`) | required | agent or admin |
| `GET /proposals`, `GET /proposals/:id` | required | agent or admin |
| `POST /proposals/:id/approve` | required | admin only |
| `POST /proposals/:id/reject` | required | admin only |

## CLI Changes

- `fruitctl auth token` takes `--role agent|admin` (default: admin) and `--secret`
- Derives the key deterministically, saves to `~/.config/fruitctl/credentials.json`
- Drop JWT minting code (no more `node:crypto` HMAC for JWT signatures)

## Config Changes

- Rename `jwtSecret` → `secret` in schema
- Rename env var `FRUITCTL_JWT_SECRET` → `FRUITCTL_SECRET`

## Dependencies

- Remove `@fastify/jwt` from `apps/core`
- No new dependencies

## Web UI

- No changes — already stores token in localStorage, sends as Bearer
- Admin token required for approve/reject; agent token will get 403
