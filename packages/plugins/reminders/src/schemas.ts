import { z } from "zod/v4";

export const listRemindersSchema = z.object({
  list: z.string().min(1).max(200),
});

export const getReminderSchema = z.object({
  id: z.string().min(1),
});

export const addReminderSchema = z.object({
  title: z.string().min(1).max(500),
  list: z.string().min(1).max(200).optional(),
  due: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  priority: z.enum(["none", "low", "medium", "high"]).optional(),
});

export const editReminderSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500).optional(),
  list: z.string().min(1).max(200).optional(),
  due: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  priority: z.enum(["none", "low", "medium", "high"]).optional(),
});

export const completeReminderSchema = z.object({
  id: z.string().min(1),
});

export const deleteReminderSchema = z.object({
  id: z.string().min(1),
});
