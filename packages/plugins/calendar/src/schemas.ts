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
