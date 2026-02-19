import { createDatabase } from "@fruitctl/db";
import { remindersAdapter } from "@fruitctl/reminders";
import type { AdapterPlugin } from "@fruitctl/shared";
import { loadConfig } from "./config.js";
import { registerAdapters } from "./registry.js";
import { createServer } from "./server.js";

const adapterMap: Record<string, AdapterPlugin> = {
	reminders: remindersAdapter,
};

async function main() {
	const config = loadConfig();
	const db = createDatabase(config.dbPath);
	const server = createServer({
		db,
		jwtSecret: config.jwtSecret,
		logger: true,
	});

	const enabledAdapters = config.adapters
		.map((name) => adapterMap[name])
		.filter(Boolean);

	const noopApproval = {
		propose: async () => ({ id: "noop", status: "auto-approved" }),
	};

	const result = await registerAdapters(server, enabledAdapters, {
		db,
		config: {},
		approval: noopApproval,
	});

	console.log(`Registered adapters: ${result.registered.join(", ")}`);
	if (result.skipped.length > 0) {
		console.log(`Skipped adapters: ${result.skipped.join(", ")}`);
	}

	await server.listen({ port: config.port, host: config.host });
	console.log(`fruitctl server listening on ${config.host}:${config.port}`);
}

main().catch((err) => {
	console.error("Failed to start server:", err);
	process.exit(1);
});
