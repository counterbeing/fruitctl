import type { ActionDef, AdapterPlugin } from "@fruitctl/shared";
export { remindersCommand } from "./commands.js";
import type { z } from "zod/v4";
import { remindersPlugin } from "./plugin.js";
import { Remindctl } from "./remindctl.js";
import {
	addReminderSchema,
	completeReminderSchema,
	deleteReminderSchema,
	editReminderSchema,
	getReminderSchema,
	listRemindersSchema,
} from "./schemas.js";

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
		actions: {
			add: {
				name: "add",
				description: "Add a new reminder",
				paramsSchema: addReminderSchema,
				validate: async (params) => addReminderSchema.parse(params),
				execute: async (params) => {
					const p = params as z.infer<typeof addReminderSchema>;
					return ctl.add(p);
				},
			},
			edit: {
				name: "edit",
				description: "Edit an existing reminder",
				paramsSchema: editReminderSchema,
				validate: async (params) => editReminderSchema.parse(params),
				execute: async (params) => {
					const p = params as z.infer<typeof editReminderSchema>;
					return ctl.edit(p.id, p);
				},
			},
			complete: {
				name: "complete",
				description: "Mark a reminder as complete",
				paramsSchema: completeReminderSchema,
				validate: async (params) => completeReminderSchema.parse(params),
				execute: async (params) => {
					const p = params as z.infer<typeof completeReminderSchema>;
					await ctl.complete(p.id);
				},
			},
			delete: {
				name: "delete",
				description: "Delete a reminder",
				paramsSchema: deleteReminderSchema,
				validate: async (params) => deleteReminderSchema.parse(params),
				execute: async (params) => {
					const p = params as z.infer<typeof deleteReminderSchema>;
					await ctl.delete(p.id);
				},
			},
		} satisfies Record<string, ActionDef>,
	},
});
