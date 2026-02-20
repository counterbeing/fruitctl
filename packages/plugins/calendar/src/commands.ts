import { apiRequest } from "@fruitctl/shared";
import { Command } from "commander";

export const calendarCommand = new Command("calendar");

calendarCommand
  .command("calendars")
  .description("List all event calendars")
  .action(async () => {
    const data = (await apiRequest("GET", "/calendar/calendars")) as any;
    for (const cal of data.items) {
      console.log(`${cal.title} (${cal.id})`);
    }
  });

calendarCommand
  .command("events")
  .description("List events in a calendar")
  .requiredOption("--calendar <id>", "Calendar ID")
  .requiredOption("--from <date>", "Start date (ISO8601)")
  .requiredOption("--to <date>", "End date (ISO8601)")
  .action(async (opts) => {
    const data = (await apiRequest(
      "GET",
      `/calendar/events?calendar=${encodeURIComponent(opts.calendar)}&from=${encodeURIComponent(opts.from)}&to=${encodeURIComponent(opts.to)}`,
    )) as any;
    for (const evt of data.items) {
      console.log(
        `${evt.title} | ${evt.startDate} - ${evt.endDate} (${evt.id})`,
      );
    }
  });

calendarCommand
  .command("show <id>")
  .description("Show details of a specific event")
  .action(async (id) => {
    const data = (await apiRequest("GET", `/calendar/events/${id}`)) as any;
    console.log(JSON.stringify(data.item, null, 2));
  });

calendarCommand
  .command("add")
  .description("Add a calendar event (creates approval proposal)")
  .requiredOption("--calendar <id>", "Calendar ID")
  .requiredOption("--title <title>", "Event title")
  .requiredOption("--start <date>", "Start date (ISO8601)")
  .requiredOption("--end <date>", "End date (ISO8601)")
  .option("--location <location>", "Location")
  .option("--notes <notes>", "Notes")
  .option("--all-day", "All-day event")
  .action(async (opts) => {
    const payload: Record<string, unknown> = {
      calendar: opts.calendar,
      title: opts.title,
      start: opts.start,
      end: opts.end,
    };
    if (opts.location) payload.location = opts.location;
    if (opts.notes) payload.notes = opts.notes;
    if (opts.allDay) payload.allDay = true;
    const data = (await apiRequest("POST", "/calendar/add", payload)) as any;
    console.log(`Proposal created: ${data.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Approve with: fruitctl proposals approve ${data.id}`);
  });

calendarCommand
  .command("rm <id>")
  .description("Delete a calendar event (creates approval proposal)")
  .action(async (id) => {
    const data = (await apiRequest("POST", "/calendar/delete", {
      id,
    })) as any;
    console.log(`Proposal created: ${data.id}`);
    console.log(`Approve with: fruitctl proposals approve ${data.id}`);
  });
