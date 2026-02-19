import type { AppDatabase } from "@fruitctl/db";
import type { FastifyInstance } from "fastify";
import type {
	AdapterPlugin,
	ApprovalEngineInterface,
	CapabilityDef,
} from "@fruitctl/shared";

export interface RegistrationResult {
	registered: string[];
	skipped: string[];
	capabilities: CapabilityDef[];
}

interface RegistrationOptions {
	db: AppDatabase;
	config: Record<string, unknown>;
	approval: ApprovalEngineInterface;
}

export async function registerAdapters(
	server: FastifyInstance,
	adapters: AdapterPlugin[],
	options: RegistrationOptions,
): Promise<RegistrationResult> {
	const registered: string[] = [];
	const skipped: string[] = [];
	const capabilities: CapabilityDef[] = [];

	for (const adapter of adapters) {
		const { manifest } = adapter;

		const depsOk = await checkDeps(manifest.nativeDeps);
		if (!depsOk) {
			server.log.warn(
				`Skipping adapter "${manifest.name}": native deps not met`,
			);
			skipped.push(manifest.name);
			continue;
		}

		await server.register(adapter, {
			prefix: `/${manifest.name}`,
			db: options.db,
			config: options.config,
			approval: options.approval,
		});

		registered.push(manifest.name);
		capabilities.push(...manifest.capabilities);
	}

	return { registered, skipped, capabilities };
}

async function checkDeps(
	deps: { name: string; check: () => Promise<boolean> }[],
): Promise<boolean> {
	for (const dep of deps) {
		if (!(await dep.check())) return false;
	}
	return true;
}
