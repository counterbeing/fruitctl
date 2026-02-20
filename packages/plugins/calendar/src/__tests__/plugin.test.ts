import { createDatabase } from "@fruitctl/db";
import { AppError } from "@fruitctl/shared";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { calendarPlugin } from "../plugin.js";

const mockCalendars = {
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
  ],
};

const mockEvents = {
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
};

const mockEventDetail = {
  status: "success",
  event: {
    id: "evt-1",
    title: "Meeting",
    startDate: "2026-02-20T09:00:00Z",
    endDate: "2026-02-20T10:00:00Z",
  },
};

describe("calendar plugin", () => {
  function buildServer() {
    const server = Fastify();
    const db = createDatabase(":memory:");

    server.setErrorHandler(async (error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(500).send({
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
          retryable: false,
          details: {},
        },
      });
    });

    server.register(calendarPlugin, {
      db,
      config: {},
      approval: {
        propose: vi
          .fn()
          .mockResolvedValue({ id: "mock-proposal", status: "pending" }),
      },
      _mockExec: vi.fn().mockImplementation(async (cmd: string) => {
        if (cmd === "ekctl list calendars") {
          return { stdout: JSON.stringify(mockCalendars) };
        }
        if (cmd.startsWith("ekctl list events")) {
          return { stdout: JSON.stringify(mockEvents) };
        }
        if (cmd.startsWith("ekctl show event")) {
          return { stdout: JSON.stringify(mockEventDetail) };
        }
        return { stdout: JSON.stringify({ status: "success" }) };
      }),
    });
    return server;
  }

  it("GET /calendars returns only event calendars", async () => {
    const server = buildServer();
    const res = await server.inject({ method: "GET", url: "/calendars" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("Work");
  });

  it("GET /events returns events for a calendar and date range", async () => {
    const server = buildServer();
    const res = await server.inject({
      method: "GET",
      url: "/events?calendar=cal-1&from=2026-02-20T00:00:00Z&to=2026-02-20T23:59:59Z",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
  });

  it("GET /events rejects missing query params", async () => {
    const server = buildServer();
    const res = await server.inject({
      method: "GET",
      url: "/events?calendar=cal-1",
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /events/:id returns a single event", async () => {
    const server = buildServer();
    const res = await server.inject({
      method: "GET",
      url: "/events/evt-1",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().item.title).toBe("Meeting");
  });

  it("POST /add creates a proposal", async () => {
    const server = buildServer();
    const res = await server.inject({
      method: "POST",
      url: "/add",
      payload: {
        calendar: "cal-1",
        title: "Dentist",
        start: "2026-02-20T09:00:00Z",
        end: "2026-02-20T10:00:00Z",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("pending");
  });

  it("POST /add rejects invalid payload", async () => {
    const server = buildServer();
    const res = await server.inject({
      method: "POST",
      url: "/add",
      payload: { title: "Missing calendar and dates" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /delete creates a proposal", async () => {
    const server = buildServer();
    const res = await server.inject({
      method: "POST",
      url: "/delete",
      payload: { id: "evt-1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("pending");
  });
});
