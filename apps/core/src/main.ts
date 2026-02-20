import { calendarAdapter } from "@fruitctl/calendar";
import { createDatabase } from "@fruitctl/db";
import { remindersAdapter } from "@fruitctl/reminders";
import type { AdapterPlugin } from "@fruitctl/shared";
import { ApprovalEngine } from "./approval.js";
import { loadConfig } from "./config.js";
import { registerProposalRoutes } from "./proposals-routes.js";
import { registerAdapters } from "./registry.js";
import { createServer } from "./server.js";
import { registerUiRoutes } from "./ui-routes.js";

const adapterMap: Record<string, AdapterPlugin> = {
	calendar: calendarAdapter,
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

	const engine = new ApprovalEngine(db);
	registerProposalRoutes(server, engine);
	registerUiRoutes(server);

	const enabledAdapters = config.adapters
		.map((name) => adapterMap[name])
		.filter(Boolean);

	const result = await registerAdapters(server, enabledAdapters, {
		db,
		config: {},
		approval: engine,
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
