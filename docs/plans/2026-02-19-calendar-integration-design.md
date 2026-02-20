# Calendar Integration Design

## Overview

`@fruitctl/calendar` — a new adapter package at `packages/plugins/calendar/` that provides approval-gated access to macOS Calendar events via ekctl.

## Native Dependency

**ekctl** (`brew tap schappim/ekctl && brew install ekctl`) — Swift CLI wrapping EventKit directly. JSON output, full CRUD for calendar events.

## Ekctl Wrapper (`ekctl.ts`)

TypeScript class wrapping shell calls to `ekctl`, same pattern as `Remindctl`:

| Method | ekctl command | Notes |
|--------|-------------|-------|
| `isAvailable()` | `ekctl --version` | Dep check |
| `listCalendars()` | `ekctl list calendars` | Filter to `type: "event"` only |
| `listEvents(calendarId, from, to)` | `ekctl list events --calendar <id> --from <iso> --to <iso>` | Required date range |
| `showEvent(id)` | `ekctl show event <id>` | Single event detail |
| `addEvent(opts)` | `ekctl add event --calendar <id> --title <t> --start <iso> --end <iso> [--location] [--notes] [--all-day]` | Write (approval-gated) |
| `deleteEvent(id)` | `ekctl delete event <id>` | Write (approval-gated) |

No "edit" command exists in ekctl, so update is excluded.

## Routes

| Route | Method | Approval? |
|-------|--------|-----------|
| `GET /calendar/calendars` | listCalendars | No |
| `GET /calendar/events` | listEvents (query: calendar, from, to) | No |
| `GET /calendar/events/:id` | showEvent | No |
| `POST /calendar/add` | addEvent -> proposal | Yes |
| `POST /calendar/delete` | deleteEvent -> proposal | Yes |

## CLI Commands

```
fruitctl calendar calendars
fruitctl calendar events --calendar <id> --from <iso> --to <iso>
fruitctl calendar show <id>
fruitctl calendar add --calendar <id> --title <t> --start <iso> --end <iso> [--location] [--notes] [--all-day]
fruitctl calendar rm <id>
```

## Zod Schemas

- `listEventsSchema` — calendar (string, required), from (ISO string, required), to (ISO string, required)
- `addEventSchema` — calendar, title, start, end (all required), location, notes, allDay (optional)
- `deleteEventSchema` — id (string, required)

## Registration

Add `@fruitctl/calendar` as dependency in `apps/core`, import and register alongside reminders in `main.ts`.
