import type { ActionDef, AdapterPlugin } from "@fruitctl/shared";

export { calendarCommand } from "./commands.js";

import type { z } from "zod/v4";
import { Ekctl } from "./ekctl.js";
import { calendarPlugin } from "./plugin.js";
import { addEventSchema, deleteEventSchema } from "./schemas.js";

const ctl = new Ekctl();

export const calendarAdapter: AdapterPlugin = Object.assign(calendarPlugin, {
  manifest: {
    name: "calendar",
    version: "0.1.0",
    nativeDeps: [
      {
        name: "ekctl",
        check: () => ctl.isAvailable(),
      },
    ],
    capabilities: [
      {
        name: "list_calendars",
        description: "List all event calendars",
        requiresApproval: false,
        paramsSchema: {} as any,
      },
      {
        name: "list_events",
        description: "List events in a calendar within a date range",
        requiresApproval: false,
        paramsSchema: {} as any,
      },
      {
        name: "show_event",
        description: "Show details of a specific event",
        requiresApproval: false,
        paramsSchema: {} as any,
      },
    ],
    actions: {
      add: {
        name: "add",
        description: "Add a new calendar event",
        paramsSchema: addEventSchema,
        validate: async (params) => addEventSchema.parse(params),
        execute: async (params) => {
          const p = params as z.infer<typeof addEventSchema>;
          return ctl.addEvent(p);
        },
      },
      delete: {
        name: "delete",
        description: "Delete a calendar event",
        paramsSchema: deleteEventSchema,
        validate: async (params) => deleteEventSchema.parse(params),
        execute: async (params) => {
          const p = params as z.infer<typeof deleteEventSchema>;
          await ctl.deleteEvent(p.id);
        },
      },
    } satisfies Record<string, ActionDef>,
  },
});
