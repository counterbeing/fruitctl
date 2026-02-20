# Init Command Design

## Problem

Setting up fruitctl requires multiple manual steps: generating a secret, setting an env var, running `auth token` for each role, and copying keys between machines. This should be a single `fruitctl init` command.

## Design

### Credentials File

Unified file at `~/.config/fruitctl/credentials.json` with two modes:

**Server mode:**
```json
{
  "mode": "server",
  "secret": "<random-base64>",
  "adminKey": "fctl_admin_<hash>",
  "agentKey": "fctl_agent_<hash>",
  "serverUrl": "http://127.0.0.1:3456"
}
```

**Client mode:**
```json
{
  "mode": "client",
  "token": "fctl_agent_<hash>",
  "serverUrl": "http://192.168.1.10:3456"
}
```

`apiRequest()` resolves the active token at read time: server mode uses `adminKey`, client mode uses `token`.

### CLI Commands

**Server init (default):**
```
fruitctl init [--server <url>] [--force]
```
- Generates 32-byte random secret via `crypto.randomBytes`
- Derives admin and agent keys via `deriveKey()`
- Writes credentials file with `mode: "server"`
- Prints both keys to stdout
- `--server` defaults to `http://127.0.0.1:3456`
- Errors if credentials file already exists unless `--force`

**Client init:**
```
fruitctl init --client <token> --server <url> [--force]
```
- `--client <token>` required
- `--server <url>` required (no default — client connects to remote)
- Writes credentials file with `mode: "client"`

### Server Config Change

`loadConfig()` falls back to reading `secret` from the credentials file when `FRUITCTL_SECRET` env var is not set. Priority: env var > credentials file.

### Removed

`fruitctl auth token` command is removed. Replaced entirely by `fruitctl init`.

### Updated Docs

- README.md setup section updated to use `fruitctl init`
- CLAUDE.md env vars section updated
