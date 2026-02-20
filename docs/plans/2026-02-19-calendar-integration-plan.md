# Calendar Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `@fruitctl/calendar` adapter that provides approval-gated read/write access to macOS Calendar events via ekctl.

**Architecture:** New adapter package at `packages/plugins/calendar/` following the exact same pattern as `@fruitctl/reminders`. Wraps the `ekctl` CLI for EventKit access. Read operations (list calendars, list events, show event) return directly. Write operations (add event, delete event) create approval proposals.

**Tech Stack:** TypeScript, Fastify plugin, Zod v4 (`zod/v4`), ekctl CLI, Commander (CLI commands)

---

### Task 1: Scaffold `@fruitctl/calendar` package

**Files:**
- Create: `packages/plugins/calendar/package.json`
- Create: `packages/plugins/calendar/tsconfig.json`
- Create: `packages/plugins/calendar/src/index.ts` (placeholder)

**Step 1: Create package.json**

Create `packages/plugins/calendar/package.json`:

```json
{
  "name": "@fruitctl/calendar",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "fastify": "^5.7",
    "zod": "^4",
    "@fruitctl/shared": "workspace:*",
    "@fruitctl/db": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9",
    "vitest": "^4"
  }
}
```

**Step 2: Create tsconfig.json**

Create `packages/plugins/calendar/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Create placeholder index.ts**

Create `packages/plugins/calendar/src/index.ts`:

```ts
export {};
```

**Step 4: Install dependencies**

Run: `pnpm install`
Expected: Lockfile updated, no errors

**Step 5: Verify build**

Run: `pnpm --filter @fruitctl/calendar build`
Expected: Clean build, no errors

**Step 6: Commit**

```bash
git add packages/plugins/calendar/ pnpm-lock.yaml
git commit -m "chore: scaffold @fruitctl/calendar package"
```

---

### Task 2: Ekctl wrapper class

**Files:**
- Create: `packages/plugins/calendar/src/ekctl.ts`
- Create: `packages/plugins/calendar/src/__tests__/ekctl.test.ts`

**Step 1: Write the failing tests**

Create `packages/plugins/calendar/src/__tests__/ekctl.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Ekctl } from "../ekctl.js";

describe("Ekctl", () => {
	it("checks if ekctl binary exists", async () => {
		const mockExec = vi.fn().mockResolvedValue({ stdout: "1.2.0" });
		const ctl = new Ekctl(mockExec);
		const available = await ctl.isAvailable();
		expect(available).toBe(true);
	});

	it("returns false when ekctl not found", async () => {
		const mockExec = vi.fn().mockRejectedValue(new Error("not found"));
		const ctl = new Ekctl(mockExec);
		const available = await ctl.isAvailable();
		expect(available).toBe(false);
	});

	it("lists only event calendars", async () => {
		const mockExec = vi.fn().mockResolvedValue({
			stdout: JSON.stringify({
				status: "success",
				calendars: [
					{ id: "cal-1", title: "Work", type: "event", source: "iCloud", allowsModifications: true, color: "#007AFF" },
					{ id: "rem-1", title: "Reminders", type: "reminder", source: "iCloud", allowsModifications: true, color: "#FF0000" },
					{ id: "cal-2", title: "Personal", type: "event", source: "iCloud", allowsModifications: true, color: "#63DA38" },
				],
			}),
		});
		const ctl = new Ekctl(mockExec);
		const calendars = await ctl.listCalendars();
		expect(mockExec).toHaveBeenCalledWith("ekctl list calendars");
		expect(calendars).toHaveLength(2);
		expect(calendars[0].title).toBe("Work");
		expect(calendars[1].title).toBe("Personal");
	});

	it("lists events in a date range", async () => {
		const mockExec = vi.fn().mockResolvedValue({
			stdout: JSON.stringify({
				status: "success",
				count: 1,
				events: [{ id: "evt-1", title: "Meeting", startDate: "2026-02-20T09:00:00Z", endDate: "2026-02-20T10:00:00Z" }],
			}),
		});
		const ctl = new Ekctl(mockExec);
		const events = await ctl.listEvents("cal-1", "2026-02-20T00:00:00Z", "2026-02-20T23:59:59Z");
		expect(mockExec).toHaveBeenCalledWith(
			'ekctl list events --calendar "cal-1" --from "2026-02-20T00:00:00Z" --to "2026-02-20T23:59:59Z"',
		);
		expect(events).toHaveLength(1);
		expect(events[0].title).toBe("Meeting");
	});

	it("shows a single event", async () => {
		const mockExec = vi.fn().mockResolvedValue({
			stdout: JSON.stringify({
				status: "success",
				event: { id: "evt-1", title: "Meeting" },
			}),
		});
		const ctl = new Ekctl(mockExec);
		const event = await ctl.showEvent("evt-1");
		expect(mockExec).toHaveBeenCalledWith('ekctl show event "evt-1"');
		expect(event.title).toBe("Meeting");
	});

	it("adds an event with all options", async () => {
		const mockExec = vi.fn().mockResolvedValue({
			stdout: JSON.stringify({ status: "success", event: { id: "new-1", title: "Dentist" } }),
		});
		const ctl = new Ekctl(mockExec);
		const result = await ctl.addEvent({
			calendar: "cal-1",
			title: "Dentist",
			start: "2026-02-20T09:00:00Z",
			end: "2026-02-20T10:00:00Z",
			location: "123 Main St",
			notes: "Bring insurance card",
			allDay: false,
		});
		expect(mockExec).toHaveBeenCalledWith(
			'ekctl add event --calendar "cal-1" --title "Dentist" --start "2026-02-20T09:00:00Z" --end "2026-02-20T10:00:00Z" --location "123 Main St" --notes "Bring insurance card"',
		);
		expect(result.event.id).toBe("new-1");
	});

	it("adds an all-day event", async () => {
		const mockExec = vi.fn().mockResolvedValue({
			stdout: JSON.stringify({ status: "success", event: { id: "new-2", title: "Holiday" } }),
		});
		const ctl = new Ekctl(mockExec);
		await ctl.addEvent({
			calendar: "cal-1",
			title: "Holiday",
			start: "2026-12-25T00:00:00Z",
			end: "2026-12-25T23:59:59Z",
			allDay: true,
		});
		expect(mockExec).toHaveBeenCalledWith(
			'ekctl add event --calendar "cal-1" --title "Holiday" --start "2026-12-25T00:00:00Z" --end "2026-12-25T23:59:59Z" --all-day',
		);
	});

	it("deletes an event", async () => {
		const mockExec = vi.fn().mockResolvedValue({
			stdout: JSON.stringify({ status: "success" }),
		});
		const ctl = new Ekctl(mockExec);
		await ctl.deleteEvent("evt-1");
		expect(mockExec).toHaveBeenCalledWith('ekctl delete event "evt-1"');
	});
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @fruitctl/calendar test`
Expected: FAIL — cannot find `../ekctl.js`

**Step 3: Write the implementation**

Create `packages/plugins/calendar/src/ekctl.ts`:

```ts
import { exec } from "node:child_process";
import { promisify } from "node:util";

type ExecFn = (cmd: string) => Promise<{ stdout: string }>;

interface Calendar {
	id: string;
	title: string;
	type: string;
	source: string;
	allowsModifications: boolean;
	color: string;
}

interface AddEventOptions {
	calendar: string;
	title: string;
	start: string;
	end: string;
	location?: string;
	notes?: string;
	allDay?: boolean;
}

const defaultExec: ExecFn = promisify(exec);

export class Ekctl {
	private exec: ExecFn;

	constructor(execFn?: ExecFn) {
		this.exec = execFn ?? defaultExec;
	}

	async isAvailable(): Promise<boolean> {
		try {
			await this.exec("ekctl --version");
			return true;
		} catch {
			return false;
		}
	}

	async listCalendars(): Promise<Calendar[]> {
		const { stdout } = await this.exec("ekctl list calendars");
		const data = JSON.parse(stdout);
		return data.calendars.filter((c: Calendar) => c.type === "event");
	}

	async listEvents(calendar: string, from: string, to: string): Promise<unknown[]> {
		const { stdout } = await this.exec(
			`ekctl list events --calendar "${calendar}" --from "${from}" --to "${to}"`,
		);
		const data = JSON.parse(stdout);
		return data.events;
	}

	async showEvent(id: string): Promise<any> {
		const { stdout } = await this.exec(`ekctl show event "${id}"`);
		const data = JSON.parse(stdout);
		return data.event;
	}

	async addEvent(opts: AddEventOptions): Promise<any> {
		const parts = ["ekctl add event"];
		parts.push(`--calendar "${opts.calendar}"`);
		parts.push(`--title "${opts.title}"`);
		parts.push(`--start "${opts.start}"`);
		parts.push(`--end "${opts.end}"`);
		if (opts.location) parts.push(`--location "${opts.location}"`);
		if (opts.notes) parts.push(`--notes "${opts.notes}"`);
		if (opts.allDay) parts.push("--all-day");
		const { stdout } = await this.exec(parts.join(" "));
		return JSON.parse(stdout);
	}

	async deleteEvent(id: string): Promise<void> {
		await this.exec(`ekctl delete event "${id}"`);
	}
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @fruitctl/calendar test`
Expected: 9 tests PASS

**Step 5: Commit**

```bash
git add packages/plugins/calendar/src/ekctl.ts packages/plugins/calendar/src/__tests__/ekctl.test.ts
git commit -m "feat(calendar): add Ekctl wrapper class"
```

---

### Task 3: Zod schemas

**Files:**
- Create: `packages/plugins/calendar/src/schemas.ts`

**Step 1: Create the schemas file**

Create `packages/plugins/calendar/src/schemas.ts`:

```ts
import { z } from "zod/v4";

export const listEventsSchema = z.object({
	calendar: z.string().min(1),
	from: z.string().min(1),
	to: z.string().min(1),
});

export const showEventSchema = z.object({
	id: z.string().min(1),
});

export const addEventSchema = z.object({
	calendar: z.string().min(1),
	title: z.string().min(1).max(500),
	start: z.string().min(1),
	end: z.string().min(1),
	location: z.string().max(500).optional(),
	notes: z.string().max(2000).optional(),
	allDay: z.boolean().optional(),
});

export const deleteEventSchema = z.object({
	id: z.string().min(1),
});
```

**Step 2: Verify build**

Run: `pnpm --filter @fruitctl/calendar build`
Expected: Clean build

**Step 3: Commit**

```bash
git add packages/plugins/calendar/src/schemas.ts
git commit -m "feat(calendar): add Zod validation schemas"
```

---

### Task 4: Fastify plugin with routes

**Files:**
- Create: `packages/plugins/calendar/src/plugin.ts`
- Create: `packages/plugins/calendar/src/__tests__/plugin.test.ts`

**Step 1: Write the failing tests**

Create `packages/plugins/calendar/src/__tests__/plugin.test.ts`:

```ts
import { AppError } from "@fruitctl/shared";
import { createDatabase } from "@fruitctl/db";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { calendarPlugin } from "../plugin.js";

const mockCalendars = {
	status: "success",
	calendars: [
		{ id: "cal-1", title: "Work", type: "event", source: "iCloud", allowsModifications: true, color: "#007AFF" },
		{ id: "rem-1", title: "Reminders", type: "reminder", source: "iCloud", allowsModifications: true, color: "#FF0000" },
	],
};

const mockEvents = {
	status: "success",
	count: 1,
	events: [
		{ id: "evt-1", title: "Meeting", startDate: "2026-02-20T09:00:00Z", endDate: "2026-02-20T10:00:00Z" },
	],
};

const mockEventDetail = {
	status: "success",
	event: { id: "evt-1", title: "Meeting", startDate: "2026-02-20T09:00:00Z", endDate: "2026-02-20T10:00:00Z" },
};

describe("calendar plugin", () => {
	function buildServer() {
		const server = Fastify();
		const db = createDatabase(":memory:");

		server.setErrorHandler(async (error, _request, reply) => {
			if (error instanceof AppError) {
				return reply.status(error.statusCode).send(error.toJSON());
			}
			return reply.status(500).send({
				error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", retryable: false, details: {} },
			});
		});

		server.register(calendarPlugin, {
			db,
			config: {},
			approval: {
				propose: vi.fn().mockResolvedValue({ id: "mock-proposal", status: "pending" }),
			},
			_mockExec: vi.fn().mockImplementation(async (cmd: string) => {
				if (cmd === "ekctl list calendars") {
					return { stdout: JSON.stringify(mockCalendars) };
				}
				if (cmd.startsWith("ekctl list events")) {
					return { stdout: JSON.stringify(mockEvents) };
				}
				if (cmd.startsWith("ekctl show event")) {
					return { stdout: JSON.stringify(mockEventDetail) };
				}
				return { stdout: JSON.stringify({ status: "success" }) };
			}),
		});
		return server;
	}

	it("GET /calendars returns only event calendars", async () => {
		const server = buildServer();
		const res = await server.inject({ method: "GET", url: "/calendars" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.items).toHaveLength(1);
		expect(body.items[0].title).toBe("Work");
	});

	it("GET /events returns events for a calendar and date range", async () => {
		const server = buildServer();
		const res = await server.inject({
			method: "GET",
			url: "/events?calendar=cal-1&from=2026-02-20T00:00:00Z&to=2026-02-20T23:59:59Z",
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().items).toHaveLength(1);
	});

	it("GET /events rejects missing query params", async () => {
		const server = buildServer();
		const res = await server.inject({
			method: "GET",
			url: "/events?calendar=cal-1",
		});
		expect(res.statusCode).toBe(400);
	});

	it("GET /events/:id returns a single event", async () => {
		const server = buildServer();
		const res = await server.inject({
			method: "GET",
			url: "/events/evt-1",
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().item.title).toBe("Meeting");
	});

	it("POST /add creates a proposal", async () => {
		const server = buildServer();
		const res = await server.inject({
			method: "POST",
			url: "/add",
			payload: {
				calendar: "cal-1",
				title: "Dentist",
				start: "2026-02-20T09:00:00Z",
				end: "2026-02-20T10:00:00Z",
			},
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().status).toBe("pending");
	});

	it("POST /add rejects invalid payload", async () => {
		const server = buildServer();
		const res = await server.inject({
			method: "POST",
			url: "/add",
			payload: { title: "Missing calendar and dates" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /delete creates a proposal", async () => {
		const server = buildServer();
		const res = await server.inject({
			method: "POST",
			url: "/delete",
			payload: { id: "evt-1" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().status).toBe("pending");
	});
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @fruitctl/calendar test`
Expected: FAIL — cannot find `../plugin.js`

**Step 3: Write the implementation**

Create `packages/plugins/calendar/src/plugin.ts`:

```ts
import type { AdapterPluginOptions } from "@fruitctl/shared";
import { AppError, ErrorCode } from "@fruitctl/shared";
import type { FastifyPluginAsync } from "fastify";
import { Ekctl } from "./ekctl.js";
import {
	addEventSchema,
	deleteEventSchema,
	listEventsSchema,
} from "./schemas.js";

interface CalendarPluginOptions extends AdapterPluginOptions {
	_mockExec?: any;
}

export const calendarPlugin: FastifyPluginAsync<
	CalendarPluginOptions
> = async (fastify, opts) => {
	const ctl = new Ekctl(opts._mockExec);

	fastify.get("/calendars", async () => {
		const calendars = await ctl.listCalendars();
		return { items: calendars };
	});

	fastify.get("/events", async (request) => {
		const query = request.query as Record<string, string>;
		const parsed = listEventsSchema.safeParse(query);
		if (!parsed.success) {
			throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
		}
		const events = await ctl.listEvents(parsed.data.calendar, parsed.data.from, parsed.data.to);
		return { items: events };
	});

	fastify.get("/events/:id", async (request) => {
		const { id } = request.params as { id: string };
		const event = await ctl.showEvent(id);
		return { item: event };
	});

	fastify.post("/add", async (request) => {
		const parsed = addEventSchema.safeParse(request.body);
		if (!parsed.success) {
			throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
		}
		return opts.approval.propose({
			adapter: "calendar",
			action: "add",
			params: parsed.data,
		});
	});

	fastify.post("/delete", async (request) => {
		const parsed = deleteEventSchema.safeParse(request.body);
		if (!parsed.success) {
			throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
		}
		return opts.approval.propose({
			adapter: "calendar",
			action: "delete",
			params: parsed.data,
		});
	});
};
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @fruitctl/calendar test`
Expected: 7 plugin tests + 9 ekctl tests = 16 tests PASS

**Step 5: Commit**

```bash
git add packages/plugins/calendar/src/plugin.ts packages/plugins/calendar/src/__tests__/plugin.test.ts
git commit -m "feat(calendar): add Fastify plugin with routes"
```

---

### Task 5: Adapter manifest and index export

**Files:**
- Modify: `packages/plugins/calendar/src/index.ts`

**Step 1: Write the full index.ts**

Replace `packages/plugins/calendar/src/index.ts` with:

```ts
import type { ActionDef, AdapterPlugin } from "@fruitctl/shared";
import type { z } from "zod/v4";
import { Ekctl } from "./ekctl.js";
import { calendarPlugin } from "./plugin.js";
import { addEventSchema, deleteEventSchema } from "./schemas.js";

const ctl = new Ekctl();

export const calendarAdapter: AdapterPlugin = Object.assign(calendarPlugin, {
	manifest: {
		name: "calendar",
		version: "0.1.0",
		nativeDeps: [
			{
				name: "ekctl",
				check: () => ctl.isAvailable(),
			},
		],
		capabilities: [
			{
				name: "list_calendars",
				description: "List all event calendars",
				requiresApproval: false,
				paramsSchema: {} as any,
			},
			{
				name: "list_events",
				description: "List events in a calendar within a date range",
				requiresApproval: false,
				paramsSchema: {} as any,
			},
			{
				name: "show_event",
				description: "Show details of a specific event",
				requiresApproval: false,
				paramsSchema: {} as any,
			},
		],
		actions: {
			add: {
				name: "add",
				description: "Add a new calendar event",
				paramsSchema: addEventSchema,
				validate: async (params) => addEventSchema.parse(params),
				execute: async (params) => {
					const p = params as z.infer<typeof addEventSchema>;
					return ctl.addEvent(p);
				},
			},
			delete: {
				name: "delete",
				description: "Delete a calendar event",
				paramsSchema: deleteEventSchema,
				validate: async (params) => deleteEventSchema.parse(params),
				execute: async (params) => {
					const p = params as z.infer<typeof deleteEventSchema>;
					await ctl.deleteEvent(p.id);
				},
			},
		} satisfies Record<string, ActionDef>,
	},
});
```

**Step 2: Verify build**

Run: `pnpm --filter @fruitctl/calendar build`
Expected: Clean build

**Step 3: Commit**

```bash
git add packages/plugins/calendar/src/index.ts
git commit -m "feat(calendar): add adapter manifest with actions"
```

---

### Task 6: Register calendar adapter in core

**Files:**
- Modify: `apps/core/src/main.ts:1-12`
- Modify: `apps/core/src/config.ts:8`
- Modify: `apps/core/package.json` (add `@fruitctl/calendar` dependency)

**Step 1: Add dependency to core**

Run: `pnpm --filter @fruitctl/core add @fruitctl/calendar@workspace:*`
Expected: Dependency added

**Step 2: Update main.ts**

In `apps/core/src/main.ts`, add the calendar import and adapter map entry.

Change:

```ts
import { remindersAdapter } from "@fruitctl/reminders";
import type { AdapterPlugin } from "@fruitctl/shared";
```

To:

```ts
import { calendarAdapter } from "@fruitctl/calendar";
import { remindersAdapter } from "@fruitctl/reminders";
import type { AdapterPlugin } from "@fruitctl/shared";
```

Change:

```ts
const adapterMap: Record<string, AdapterPlugin> = {
	reminders: remindersAdapter,
};
```

To:

```ts
const adapterMap: Record<string, AdapterPlugin> = {
	calendar: calendarAdapter,
	reminders: remindersAdapter,
};
```

**Step 3: Update default adapters in config**

In `apps/core/src/config.ts`, change:

```ts
adapters: z.array(z.string()).default(["reminders"]),
```

To:

```ts
adapters: z.array(z.string()).default(["reminders", "calendar"]),
```

**Step 4: Run all tests**

Run: `pnpm -r test`
Expected: All tests pass (existing + new calendar tests)

**Step 5: Commit**

```bash
git add apps/core/src/main.ts apps/core/src/config.ts apps/core/package.json pnpm-lock.yaml
git commit -m "feat(core): register calendar adapter"
```

---

### Task 7: CLI calendar commands

**Files:**
- Create: `apps/cli/src/commands/calendar.ts`
- Modify: `apps/cli/src/index.ts:1-20`

**Step 1: Create the calendar CLI commands**

Create `apps/cli/src/commands/calendar.ts`:

```ts
import { Command } from "commander";
import { apiRequest } from "../http.js";

export const calendarCommand = new Command("calendar");

calendarCommand
	.command("calendars")
	.description("List all event calendars")
	.action(async () => {
		const data = (await apiRequest("GET", "/calendar/calendars")) as any;
		for (const cal of data.items) {
			console.log(`${cal.title} (${cal.id})`);
		}
	});

calendarCommand
	.command("events")
	.description("List events in a calendar")
	.requiredOption("--calendar <id>", "Calendar ID")
	.requiredOption("--from <date>", "Start date (ISO8601)")
	.requiredOption("--to <date>", "End date (ISO8601)")
	.action(async (opts) => {
		const data = (await apiRequest(
			"GET",
			`/calendar/events?calendar=${encodeURIComponent(opts.calendar)}&from=${encodeURIComponent(opts.from)}&to=${encodeURIComponent(opts.to)}`,
		)) as any;
		for (const evt of data.items) {
			console.log(`${evt.title} | ${evt.startDate} - ${evt.endDate} (${evt.id})`);
		}
	});

calendarCommand
	.command("show <id>")
	.description("Show details of a specific event")
	.action(async (id) => {
		const data = (await apiRequest("GET", `/calendar/events/${id}`)) as any;
		console.log(JSON.stringify(data.item, null, 2));
	});

calendarCommand
	.command("add")
	.description("Add a calendar event (creates approval proposal)")
	.requiredOption("--calendar <id>", "Calendar ID")
	.requiredOption("--title <title>", "Event title")
	.requiredOption("--start <date>", "Start date (ISO8601)")
	.requiredOption("--end <date>", "End date (ISO8601)")
	.option("--location <location>", "Location")
	.option("--notes <notes>", "Notes")
	.option("--all-day", "All-day event")
	.action(async (opts) => {
		const payload: Record<string, unknown> = {
			calendar: opts.calendar,
			title: opts.title,
			start: opts.start,
			end: opts.end,
		};
		if (opts.location) payload.location = opts.location;
		if (opts.notes) payload.notes = opts.notes;
		if (opts.allDay) payload.allDay = true;
		const data = (await apiRequest("POST", "/calendar/add", payload)) as any;
		console.log(`Proposal created: ${data.id}`);
		console.log(`Status: ${data.status}`);
		console.log(`Approve with: fruitctl proposals approve ${data.id}`);
	});

calendarCommand
	.command("rm <id>")
	.description("Delete a calendar event (creates approval proposal)")
	.action(async (id) => {
		const data = (await apiRequest("POST", "/calendar/delete", { id })) as any;
		console.log(`Proposal created: ${data.id}`);
		console.log(`Approve with: fruitctl proposals approve ${data.id}`);
	});
```

**Step 2: Register in CLI index**

In `apps/cli/src/index.ts`, add the import and registration:

Add import:
```ts
import { calendarCommand } from "./commands/calendar.js";
```

Add after `program.addCommand(remindersCommand);`:
```ts
program.addCommand(calendarCommand);
```

**Step 3: Build CLI**

Run: `pnpm --filter @fruitctl/cli build`
Expected: Clean build

**Step 4: Verify help output**

Run: `node apps/cli/dist/index.js calendar --help`
Expected: Shows calendars, events, show, add, rm subcommands

**Step 5: Commit**

```bash
git add apps/cli/src/commands/calendar.ts apps/cli/src/index.ts
git commit -m "feat(cli): add calendar CLI commands"
```

---

### Task 8: Manual smoke test

**Step 1: Rebuild everything**

Run: `pnpm -r build`
Expected: All packages build successfully

**Step 2: Run full test suite**

Run: `pnpm -r test`
Expected: All tests pass

**Step 3: Start server**

Run: `FRUITCTL_JWT_SECRET=test-secret-long-enough node apps/core/dist/main.js`
Expected: Server starts, logs `Registered adapters: reminders, calendar`

**Step 4: Test read operations**

```bash
node apps/cli/dist/index.js calendar calendars
node apps/cli/dist/index.js calendar events --calendar <id-from-above> --from 2026-02-19T00:00:00Z --to 2026-02-26T23:59:59Z
```

**Step 5: Test write flow**

```bash
node apps/cli/dist/index.js calendar add --calendar <id> --title "Test from fruitctl" --start 2026-02-21T10:00:00Z --end 2026-02-21T11:00:00Z
node apps/cli/dist/index.js proposals list
node apps/cli/dist/index.js proposals approve <proposal-id>
```

Verify the event appears in Calendar.app.

**Step 6: Clean up test event**

```bash
node apps/cli/dist/index.js calendar rm <event-id>
node apps/cli/dist/index.js proposals approve <proposal-id>
```

**Step 7: Commit any fixes**

If any fixes were needed during testing, commit them.
