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

export interface ActionDef {
  name: string;
  description: string;
  paramsSchema: ZodType;
  validate: (params: unknown) => Promise<unknown>;
  execute: (params: unknown) => Promise<unknown>;
}

export interface ApprovalEngineInterface {
  propose(input: {
    adapter: string;
    action: string;
    params: unknown;
  }): Promise<{ id: string; status: string }>;
}

export interface AdapterManifest {
  name: string;
  version: string;
  nativeDeps: NativeDep[];
  capabilities: CapabilityDef[];
  actions?: Record<string, ActionDef>;
}

export interface AdapterPluginOptions {
  db: AppDatabase;
  config: Record<string, unknown>;
  approval: ApprovalEngineInterface;
}

export type AdapterPlugin = FastifyPluginAsync<AdapterPluginOptions> & {
  manifest: AdapterManifest;
};
