# @fruitctl/calendar

Calendar adapter for fruitctl. Wraps the native macOS `ekctl` CLI.

## Routes

All routes are prefixed with `/calendar` and require a Bearer token.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/calendars` | agent | List all calendars |
| `GET` | `/events?calendar=...&from=...&to=...` | agent | List events in a date range |
| `GET` | `/events/:id` | agent | Get a single event by ID |
| `POST` | `/add` | agent | Propose adding an event |
| `POST` | `/delete` | agent | Propose deleting an event |

### GET /events

Query parameters (all required):

| Param | Description |
|-------|-------------|
| `calendar` | Calendar name |
| `from` | Start date |
| `to` | End date |

### POST /add

Creates a proposal. Requires admin approval before execution.

```json
{
  "calendar": "Personal",
  "title": "Team standup",
  "start": "2026-02-20T09:00:00",
  "end": "2026-02-20T09:30:00",
  "location": "Zoom",
  "notes": "Weekly sync",
  "allDay": false
}
```

`location`, `notes`, and `allDay` are optional.

### POST /delete

Creates a proposal. Requires admin approval before execution.

```json
{ "id": "event-id" }
```
