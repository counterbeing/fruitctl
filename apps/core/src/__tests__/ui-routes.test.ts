import { createDatabase } from "@fruitctl/db";
import { describe, expect, it } from "vitest";
import { createServer } from "../server.js";
import { registerUiRoutes } from "../ui-routes.js";

function buildApp() {
  const db = createDatabase(":memory:");
  const server = createServer({ db, jwtSecret: "test-secret-long-enough" });
  registerUiRoutes(server);
  return { server };
}

describe("ui-routes", () => {
  it("GET / returns HTML with 200", async () => {
    const { server } = buildApp();
    const res = await server.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });

  it("GET / does not require authentication", async () => {
    const { server } = buildApp();
    const res = await server.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
  });

  it("HTML contains token input", async () => {
    const { server } = buildApp();
    const res = await server.inject({ method: "GET", url: "/" });
    expect(res.body).toContain('id="token-input"');
  });

  it("HTML contains proposals container", async () => {
    const { server } = buildApp();
    const res = await server.inject({ method: "GET", url: "/" });
    expect(res.body).toContain('id="pending"');
    expect(res.body).toContain('id="history"');
  });

  it("HTML contains polling JS", async () => {
    const { server } = buildApp();
    const res = await server.inject({ method: "GET", url: "/" });
    expect(res.body).toContain("setInterval");
    expect(res.body).toContain("/proposals");
  });
});
