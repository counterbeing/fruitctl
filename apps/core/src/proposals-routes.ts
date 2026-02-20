import { AppError, ErrorCode } from "@fruitctl/shared";
import type { FastifyInstance } from "fastify";
import type { ApprovalEngine } from "./approval.js";

function requireAdmin(server: FastifyInstance) {
  return [
    server.authenticate,
    async (request: import("fastify").FastifyRequest) => {
      if (request.role !== "admin") {
        throw new AppError(ErrorCode.FORBIDDEN, "Admin access required");
      }
    },
  ];
}

export function registerProposalRoutes(
  server: FastifyInstance,
  engine: ApprovalEngine,
) {
  server.get(
    "/proposals",
    { preHandler: [server.authenticate] },
    async (request) => {
      const { status } = request.query as { status?: string };
      const items = await engine.list(status ? { status } : undefined);
      return { items };
    },
  );

  server.get(
    "/proposals/:id",
    { preHandler: [server.authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      return engine.get(id);
    },
  );

  server.post(
    "/proposals/:id/approve",
    { preHandler: requireAdmin(server) },
    async (request) => {
      const { id } = request.params as { id: string };
      return engine.approve(id, request.role);
    },
  );

  server.post(
    "/proposals/:id/reject",
    { preHandler: requireAdmin(server) },
    async (request) => {
      const { id } = request.params as { id: string };
      return engine.reject(id, request.role);
    },
  );
}
