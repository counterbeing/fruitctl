import type { FastifyInstance } from "fastify";
import type { ApprovalEngine } from "./approval.js";

export function registerProposalRoutes(
  server: FastifyInstance,
  engine: ApprovalEngine,
) {
  server.get("/proposals", async (request) => {
    const { status } = request.query as { status?: string };
    const items = await engine.list(status ? { status } : undefined);
    return { items };
  });

  server.get("/proposals/:id", async (request) => {
    const { id } = request.params as { id: string };
    return engine.get(id);
  });

  server.post("/proposals/:id/approve", async (request) => {
    const { id } = request.params as { id: string };
    return engine.approve(id, "cli");
  });

  server.post("/proposals/:id/reject", async (request) => {
    const { id } = request.params as { id: string };
    return engine.reject(id, "cli");
  });
}
