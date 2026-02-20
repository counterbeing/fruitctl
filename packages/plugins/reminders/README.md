# @fruitctl/reminders

Reminders adapter for fruitctl. Wraps the native macOS `remindctl` CLI.

## Routes

All routes are prefixed with `/reminders` and require a Bearer token.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/lists` | agent | List all reminder lists |
| `POST` | `/list` | agent | List reminders in a specific list |
| `POST` | `/get` | agent | Get a single reminder by ID |
| `POST` | `/add` | agent | Propose adding a reminder |
| `POST` | `/edit` | agent | Propose editing a reminder |
| `POST` | `/complete` | agent | Propose completing a reminder |
| `POST` | `/delete` | agent | Propose deleting a reminder |

### POST /list

```json
{ "list": "Shopping" }
```

### POST /get

```json
{ "id": "reminder-id" }
```

### POST /add

Creates a proposal. Requires admin approval before execution.

```json
{
  "title": "Buy milk",
  "list": "Shopping",
  "due": "2026-02-20 17:00",
  "notes": "Oat milk preferred",
  "priority": "medium"
}
```

All fields except `title` are optional. `priority` is one of: `none`, `low`, `medium`, `high`.

### POST /edit

Creates a proposal. Requires admin approval before execution.

```json
{
  "id": "reminder-id",
  "title": "Buy oat milk",
  "priority": "high"
}
```

All fields except `id` are optional.

### POST /complete

Creates a proposal. Requires admin approval before execution.

```json
{ "id": "reminder-id" }
```

### POST /delete

Creates a proposal. Requires admin approval before execution.

```json
{ "id": "reminder-id" }
```
