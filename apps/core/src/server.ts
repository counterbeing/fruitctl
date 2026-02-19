import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import type { AppDatabase } from "@fruitctl/db";
import { AppError, ErrorCode } from "./errors.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

export interface ServerOptions {
  db: AppDatabase;
  jwtSecret: string;
  host?: string;
  port?: number;
  logger?: boolean;
}

export function createServer(options: ServerOptions) {
  const server = Fastify({
    logger: options.logger ?? false,
  });

  server.register(fastifyJwt, { secret: options.jwtSecret });

  server.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or missing token");
      }
    }
  );

  server.get("/health", async () => ({ status: "ok" }));

  server.setErrorHandler(async (error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }
    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        retryable: false,
        details: {},
      },
    });
  });

  return server;
}
