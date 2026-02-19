import type { AdapterPluginOptions } from "@fruitctl/shared";
import { AppError, ErrorCode } from "@fruitctl/shared";
import type { FastifyPluginAsync } from "fastify";
import { Remindctl } from "./remindctl.js";
import {
	addReminderSchema,
	completeReminderSchema,
	deleteReminderSchema,
	editReminderSchema,
	getReminderSchema,
	listRemindersSchema,
} from "./schemas.js";

interface RemindersPluginOptions extends AdapterPluginOptions {
	_mockExec?: any;
}

export const remindersPlugin: FastifyPluginAsync<
	RemindersPluginOptions
> = async (fastify, opts) => {
	const ctl = new Remindctl(opts._mockExec);

	fastify.get("/lists", async () => {
		const lists = await ctl.listLists();
		return { items: lists };
	});

	fastify.post("/list", async (request) => {
		const parsed = listRemindersSchema.safeParse(request.body);
		if (!parsed.success) {
			throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
		}
		const reminders = await ctl.listReminders(parsed.data.list);
		return { items: reminders };
	});

	fastify.post("/get", async (request) => {
		const parsed = getReminderSchema.safeParse(request.body);
		if (!parsed.success) {
			throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
		}
		const reminder = await ctl.getReminder(parsed.data.id);
		if (!reminder) {
			throw new AppError(
				ErrorCode.NOT_FOUND,
				`Reminder "${parsed.data.id}" not found`,
			);
		}
		return { item: reminder };
	});

	fastify.post("/add", async (request) => {
		const parsed = addReminderSchema.safeParse(request.body);
		if (!parsed.success) {
			throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
		}
		return opts.approval.propose({
			adapter: "reminders",
			action: "add",
			params: parsed.data,
		});
	});

	fastify.post("/edit", async (request) => {
		const parsed = editReminderSchema.safeParse(request.body);
		if (!parsed.success) {
			throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
		}
		return opts.approval.propose({
			adapter: "reminders",
			action: "edit",
			params: parsed.data,
		});
	});

	fastify.post("/complete", async (request) => {
		const parsed = completeReminderSchema.safeParse(request.body);
		if (!parsed.success) {
			throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
		}
		return opts.approval.propose({
			adapter: "reminders",
			action: "complete",
			params: parsed.data,
		});
	});

	fastify.post("/delete", async (request) => {
		const parsed = deleteReminderSchema.safeParse(request.body);
		if (!parsed.success) {
			throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.message);
		}
		return opts.approval.propose({
			adapter: "reminders",
			action: "delete",
			params: parsed.data,
		});
	});
};
