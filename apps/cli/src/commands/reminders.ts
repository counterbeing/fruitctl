import { Command } from "commander";
import { apiRequest } from "../http.js";

export const remindersCommand = new Command("reminders");

remindersCommand
	.command("lists")
	.description("List all reminder lists")
	.action(async () => {
		const data = (await apiRequest("GET", "/reminders/lists")) as any;
		for (const list of data.items) {
			console.log(`${list.title} (${list.id})`);
		}
	});

remindersCommand
	.command("list <name>")
	.description("List reminders in a specific list")
	.action(async (name) => {
		const data = (await apiRequest("POST", "/reminders/list", {
			list: name,
		})) as any;
		for (const r of data.items) {
			const check = r.isCompleted ? "[x]" : "[ ]";
			console.log(`${check} ${r.title} (${r.id})`);
		}
	});

remindersCommand
	.command("get <id>")
	.description("Get a specific reminder")
	.action(async (id) => {
		const data = (await apiRequest("POST", "/reminders/get", { id })) as any;
		console.log(JSON.stringify(data.item, null, 2));
	});

remindersCommand
	.command("add")
	.description("Add a reminder (creates approval proposal)")
	.requiredOption("--title <title>", "Reminder title")
	.option("--list <list>", "Target list")
	.option("--due <due>", "Due date")
	.option("--notes <notes>", "Notes")
	.option("--priority <priority>", "Priority (none, low, medium, high)")
	.action(async (opts) => {
		const payload: Record<string, string> = { title: opts.title };
		if (opts.list) payload.list = opts.list;
		if (opts.due) payload.due = opts.due;
		if (opts.notes) payload.notes = opts.notes;
		if (opts.priority) payload.priority = opts.priority;
		const data = (await apiRequest("POST", "/reminders/add", payload)) as any;
		console.log(`Proposal created: ${data.id}`);
		console.log(`Status: ${data.status}`);
		console.log(`Approve with: fruitctl proposals approve ${data.id}`);
	});

remindersCommand
	.command("complete <id>")
	.description("Complete a reminder (creates approval proposal)")
	.action(async (id) => {
		const data = (await apiRequest("POST", "/reminders/complete", { id })) as any;
		console.log(`Proposal created: ${data.id}`);
		console.log(`Approve with: fruitctl proposals approve ${data.id}`);
	});

remindersCommand
	.command("edit <id>")
	.description("Edit a reminder (creates approval proposal)")
	.option("--title <title>", "New title")
	.option("--list <list>", "Move to list")
	.option("--due <due>", "Set due date")
	.option("--notes <notes>", "Set notes")
	.option("--priority <priority>", "Set priority")
	.action(async (id, opts) => {
		const payload: Record<string, string> = { id };
		if (opts.title) payload.title = opts.title;
		if (opts.list) payload.list = opts.list;
		if (opts.due) payload.due = opts.due;
		if (opts.notes) payload.notes = opts.notes;
		if (opts.priority) payload.priority = opts.priority;
		const data = (await apiRequest("POST", "/reminders/edit", payload)) as any;
		console.log(`Proposal created: ${data.id}`);
		console.log(`Approve with: fruitctl proposals approve ${data.id}`);
	});

remindersCommand
	.command("rm <id>")
	.description("Delete a reminder (creates approval proposal)")
	.action(async (id) => {
		const data = (await apiRequest("POST", "/reminders/delete", { id })) as any;
		console.log(`Proposal created: ${data.id}`);
		console.log(`Approve with: fruitctl proposals approve ${data.id}`);
	});
