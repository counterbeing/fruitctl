import type { AdapterPlugin } from "@fruitctl/core";
import { remindersPlugin } from "./plugin.js";
import { listRemindersSchema, getReminderSchema } from "./schemas.js";
import { Remindctl } from "./remindctl.js";

const ctl = new Remindctl();

export const remindersAdapter: AdapterPlugin = Object.assign(remindersPlugin, {
	manifest: {
		name: "reminders",
		version: "0.1.0",
		nativeDeps: [
			{
				name: "remindctl",
				check: () => ctl.isAvailable(),
			},
		],
		capabilities: [
			{
				name: "list_lists",
				description: "List all Reminders lists",
				requiresApproval: false,
				paramsSchema: {} as any,
			},
			{
				name: "list_reminders",
				description: "List reminders in a specific list",
				requiresApproval: false,
				paramsSchema: listRemindersSchema,
			},
			{
				name: "get_reminder",
				description: "Get a specific reminder by ID",
				requiresApproval: false,
				paramsSchema: getReminderSchema,
			},
		],
	},
});
