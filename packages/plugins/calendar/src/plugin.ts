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
		const events = await ctl.listEvents(
			parsed.data.calendar,
			parsed.data.from,
			parsed.data.to,
		);
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
