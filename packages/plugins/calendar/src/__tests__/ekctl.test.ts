import { describe, expect, it, vi } from "vitest";
import { Ekctl } from "../ekctl.js";

describe("Ekctl", () => {
  it("checks if ekctl binary exists", async () => {
    const mockExec = vi.fn().mockResolvedValue({ stdout: "1.2.0" });
    const ctl = new Ekctl(mockExec);
    const available = await ctl.isAvailable();
    expect(available).toBe(true);
  });

  it("returns false when ekctl not found", async () => {
    const mockExec = vi.fn().mockRejectedValue(new Error("not found"));
    const ctl = new Ekctl(mockExec);
    const available = await ctl.isAvailable();
    expect(available).toBe(false);
  });

  it("lists only event calendars", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        status: "success",
        calendars: [
          {
            id: "cal-1",
            title: "Work",
            type: "event",
            source: "iCloud",
            allowsModifications: true,
            color: "#007AFF",
          },
          {
            id: "rem-1",
            title: "Reminders",
            type: "reminder",
            source: "iCloud",
            allowsModifications: true,
            color: "#FF0000",
          },
          {
            id: "cal-2",
            title: "Personal",
            type: "event",
            source: "iCloud",
            allowsModifications: true,
            color: "#63DA38",
          },
        ],
      }),
    });
    const ctl = new Ekctl(mockExec);
    const calendars = await ctl.listCalendars();
    expect(mockExec).toHaveBeenCalledWith("ekctl list calendars");
    expect(calendars).toHaveLength(2);
    expect(calendars[0].title).toBe("Work");
    expect(calendars[1].title).toBe("Personal");
  });

  it("lists events in a date range", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        status: "success",
        count: 1,
        events: [
          {
            id: "evt-1",
            title: "Meeting",
            startDate: "2026-02-20T09:00:00Z",
            endDate: "2026-02-20T10:00:00Z",
          },
        ],
      }),
    });
    const ctl = new Ekctl(mockExec);
    const events = await ctl.listEvents(
      "cal-1",
      "2026-02-20T00:00:00Z",
      "2026-02-20T23:59:59Z",
    );
    expect(mockExec).toHaveBeenCalledWith(
      'ekctl list events --calendar "cal-1" --from "2026-02-20T00:00:00Z" --to "2026-02-20T23:59:59Z"',
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toHaveProperty("title", "Meeting");
  });

  it("shows a single event", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        status: "success",
        event: { id: "evt-1", title: "Meeting" },
      }),
    });
    const ctl = new Ekctl(mockExec);
    const event = await ctl.showEvent("evt-1");
    expect(mockExec).toHaveBeenCalledWith('ekctl show event "evt-1"');
    expect(event.title).toBe("Meeting");
  });

  it("adds an event with all options", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        status: "success",
        event: { id: "new-1", title: "Dentist" },
      }),
    });
    const ctl = new Ekctl(mockExec);
    const result = await ctl.addEvent({
      calendar: "cal-1",
      title: "Dentist",
      start: "2026-02-20T09:00:00Z",
      end: "2026-02-20T10:00:00Z",
      location: "123 Main St",
      notes: "Bring insurance card",
      allDay: false,
    });
    expect(mockExec).toHaveBeenCalledWith(
      'ekctl add event --calendar "cal-1" --title "Dentist" --start "2026-02-20T09:00:00Z" --end "2026-02-20T10:00:00Z" --location "123 Main St" --notes "Bring insurance card"',
    );
    expect(result.event.id).toBe("new-1");
  });

  it("adds an all-day event", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        status: "success",
        event: { id: "new-2", title: "Holiday" },
      }),
    });
    const ctl = new Ekctl(mockExec);
    await ctl.addEvent({
      calendar: "cal-1",
      title: "Holiday",
      start: "2026-12-25T00:00:00Z",
      end: "2026-12-25T23:59:59Z",
      allDay: true,
    });
    expect(mockExec).toHaveBeenCalledWith(
      'ekctl add event --calendar "cal-1" --title "Holiday" --start "2026-12-25T00:00:00Z" --end "2026-12-25T23:59:59Z" --all-day',
    );
  });

  it("deletes an event", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ status: "success" }),
    });
    const ctl = new Ekctl(mockExec);
    await ctl.deleteEvent("evt-1");
    expect(mockExec).toHaveBeenCalledWith('ekctl delete event "evt-1"');
  });
});
