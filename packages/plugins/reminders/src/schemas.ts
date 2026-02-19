import { z } from "zod/v4";

export const listRemindersSchema = z.object({
	list: z.string().min(1).max(200),
});

export const getReminderSchema = z.object({
	id: z.string().min(1),
});
