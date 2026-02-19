import { createDatabase } from "@fruitctl/db";
import { createServer } from "./server.js";
import { registerAdapters } from "./registry.js";
import { loadConfig } from "./config.js";
import type { AdapterPlugin } from "./adapter.js";

async function loadAdapterMap(): Promise<Record<string, AdapterPlugin>> {
	const map: Record<string, AdapterPlugin> = {};
	try {
		const { remindersAdapter } = await import("@fruitctl/reminders");
		map.reminders = remindersAdapter;
	} catch {
		// reminders package not available
	}
	return map;
}

async function main() {
	const config = loadConfig();
	const db = createDatabase(config.dbPath);
	const server = createServer({
		db,
		jwtSecret: config.jwtSecret,
		logger: true,
	});

	const adapterMap = await loadAdapterMap();
	const enabledAdapters = config.adapters
		.map((name) => adapterMap[name])
		.filter(Boolean);

	const result = await registerAdapters(server, enabledAdapters, {
		db,
		config: {},
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
