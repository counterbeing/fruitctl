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
