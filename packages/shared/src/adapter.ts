import type { AppDatabase } from "@fruitctl/db";
import type { FastifyPluginAsync } from "fastify";
import type { ZodType } from "zod/v4";

export interface NativeDep {
	name: string;
	check: () => Promise<boolean>;
}

export interface CapabilityDef {
	name: string;
	description: string;
	requiresApproval: boolean;
	paramsSchema: ZodType;
}

export interface AdapterManifest {
	name: string;
	version: string;
	nativeDeps: NativeDep[];
	capabilities: CapabilityDef[];
}

export interface AdapterPluginOptions {
	db: AppDatabase;
	config: Record<string, unknown>;
}

export type AdapterPlugin = FastifyPluginAsync<AdapterPluginOptions> & {
	manifest: AdapterManifest;
};
