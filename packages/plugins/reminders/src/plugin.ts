import type { AdapterPluginOptions } from "@fruitctl/core";
import { AppError, ErrorCode } from "@fruitctl/core";
import type { FastifyPluginAsync } from "fastify";
import { Remindctl } from "./remindctl.js";
import { getReminderSchema, listRemindersSchema } from "./schemas.js";

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
};
