import type { AppDatabase } from "@fruitctl/db";
import { AppError, ErrorCode } from "@fruitctl/shared";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import type { Role } from "./auth.js";
import { deriveKey } from "./auth.js";

declare module "fastify" {
	interface FastifyInstance {
		authenticate: (
			request: FastifyRequest,
			reply: FastifyReply,
		) => Promise<void>;
	}
	interface FastifyRequest {
		role: Role;
	}
}

export interface ServerOptions {
	db: AppDatabase;
	secret: string;
	host?: string;
	port?: number;
	logger?: boolean;
}

export function createServer(options: ServerOptions) {
	const server = Fastify({
		logger: options.logger ?? false,
	});

	const adminKey = deriveKey("admin", options.secret);
	const agentKey = deriveKey("agent", options.secret);

	server.decorateRequest("role", "");

	server.decorate(
		"authenticate",
		async (request: FastifyRequest, _reply: FastifyReply) => {
			const header = request.headers.authorization;
			if (!header?.startsWith("Bearer ")) {
				throw new AppError(ErrorCode.UNAUTHORIZED, "Missing authorization token");
			}
			const token = header.slice(7);
			if (token === adminKey) {
				request.role = "admin";
			} else if (token === agentKey) {
				request.role = "agent";
			} else {
				throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid authorization token");
			}
		},
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
